/**
 * Fase 6 — Favorecidos padrão.
 *
 * Catálogo global (tabela `favorecidos_padrao`) com overrides determinísticos
 * de CNPJ + nome para guias federais conhecidas (DARF/GPS/GFIP) e favorecidos
 * recorrentes (Sanepar, Copel, …). Roda no servidor após a pipeline de NF-e.
 *
 * Fallback hardcoded é mantido só para o caso de a query falhar — o catálogo
 * real vive no banco e pode ser administrado pelo super_admin.
 */
import type { DespesaExtraida } from "./schema";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Override = { cnpj: string; nome: string; motivo: string };

export type CatalogoFavorecidos = {
  porSubtipo: Record<number, Override>;
  porNome: Array<{ regex: RegExp; cnpj: string; nome: string; motivo: string }>;
};

const FALLBACK: CatalogoFavorecidos = {
  porSubtipo: {
    7: { cnpj: "00394460000141", nome: "MINISTERIO DA FAZENDA - MATRIZ", motivo: "DARF" },
    9: { cnpj: "16727230000197", nome: "FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL", motivo: "GPS" },
    10: { cnpj: "00360305000104", nome: "CAIXA ECONOMICA FEDERAL", motivo: "GFIP" },
  },
  porNome: [
    { regex: /\bSANEPAR\b/i, cnpj: "76484013000145", nome: "COMPANHIA DE SANEAMENTO DO PARANA - SANEPAR", motivo: "Sanepar (override fixo)" },
    { regex: /COPEL/i, cnpj: "76483817000120", nome: "COPEL DISTRIBUICAO S.A.", motivo: "Copel (override fixo)" },
  ],
};

let cache: { at: number; data: CatalogoFavorecidos } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function carregarFavorecidos(): Promise<CatalogoFavorecidos> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const { data, error } = await supabaseAdmin
      .from("favorecidos_padrao")
      .select("cnpj, nome, categoria, match_subtipo, match_regex, ativo")
      .eq("ativo", true);
    if (error) throw error;
    const cat: CatalogoFavorecidos = { porSubtipo: {}, porNome: [] };
    for (const row of data ?? []) {
      if (row.match_subtipo != null) {
        cat.porSubtipo[row.match_subtipo] = {
          cnpj: row.cnpj,
          nome: row.nome,
          motivo: row.categoria,
        };
      }
      if (row.match_regex) {
        try {
          cat.porNome.push({
            regex: new RegExp(row.match_regex, "i"),
            cnpj: row.cnpj,
            nome: row.nome,
            motivo: `${row.categoria} (catálogo)`,
          });
        } catch {
          // regex inválida no banco — ignora
        }
      }
    }
    cache = { at: Date.now(), data: cat };
    return cat;
  } catch (e) {
    console.warn("[favorecidosPadrao] falha ao carregar do banco, usando fallback", e);
    return FALLBACK;
  }
}

export type AjusteFavorecido = { aplicado: boolean; motivo?: string };

export function aplicarFavorecidoPadrao(
  d: DespesaExtraida,
  cat: CatalogoFavorecidos,
): { despesa: DespesaExtraida; ajuste: AjusteFavorecido } {
  if (d.subtipoDocumento && cat.porSubtipo[d.subtipoDocumento]) {
    const o = cat.porSubtipo[d.subtipoDocumento];
    if (o.cnpj) {
      return {
        despesa: { ...d, tpDocFav: "CNPJ", nrDocFav: o.cnpj, favorecido: o.nome },
        ajuste: { aplicado: true, motivo: o.motivo },
      };
    }
  }
  for (const o of cat.porNome) {
    if (o.regex.test(d.favorecido)) {
      return {
        despesa: { ...d, tpDocFav: "CNPJ", nrDocFav: o.cnpj, favorecido: o.nome },
        ajuste: { aplicado: true, motivo: o.motivo },
      };
    }
  }
  return { despesa: d, ajuste: { aplicado: false } };
}
