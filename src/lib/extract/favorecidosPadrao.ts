/**
 * Fase 6 — Favorecidos padrão.
 *
 * Aplica overrides determinísticos de CNPJ + nome quando a despesa é uma guia
 * federal conhecida (DARF, GPS, GFIP, GRRF, GFD, GR/PR) ou um favorecido
 * recorrente cujo CNPJ a IA costuma errar (ex.: SANEPAR).
 *
 * Roda no servidor depois da pipeline de NF-e/Boleto.
 */
import type { DespesaExtraida } from "./schema";

type Override = { cnpj: string; nome: string; motivo: string };

// Por subtipoDocumento legado (3+subtipo ou 4+subtipo).
const OVERRIDES_POR_SUBTIPO: Record<number, Override> = {
  7: { cnpj: "00394460000141", nome: "MINISTERIO DA FAZENDA - MATRIZ", motivo: "DARF" },
  9: { cnpj: "16727230000197", nome: "FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL", motivo: "GPS" },
  10: { cnpj: "00360305000104", nome: "CAIXA ECONOMICA FEDERAL", motivo: "GFIP" },
  8: { cnpj: "", nome: "", motivo: "" }, // DAM-ISS: município varia, não força
};

// Favorecidos recorrentes que a IA costuma errar.
const OVERRIDES_POR_NOME: Array<{ regex: RegExp; cnpj: string; nome: string; motivo: string }> = [
  {
    regex: /\bSANEPAR\b/i,
    cnpj: "76484013000145",
    nome: "COMPANHIA DE SANEAMENTO DO PARANA - SANEPAR",
    motivo: "Sanepar (override fixo)",
  },
  {
    regex: /COPEL/i,
    cnpj: "76483817000120",
    nome: "COPEL DISTRIBUICAO S.A.",
    motivo: "Copel (override fixo)",
  },
];

export type AjusteFavorecido = {
  aplicado: boolean;
  motivo?: string;
};

export function aplicarFavorecidoPadrao(d: DespesaExtraida): {
  despesa: DespesaExtraida;
  ajuste: AjusteFavorecido;
} {
  // 1) Subtipo de guia federal
  if (d.subtipoDocumento && OVERRIDES_POR_SUBTIPO[d.subtipoDocumento]) {
    const o = OVERRIDES_POR_SUBTIPO[d.subtipoDocumento];
    if (o.cnpj) {
      return {
        despesa: { ...d, tpDocFav: "CNPJ", nrDocFav: o.cnpj, favorecido: o.nome },
        ajuste: { aplicado: true, motivo: o.motivo },
      };
    }
  }
  // 2) Nome recorrente
  for (const o of OVERRIDES_POR_NOME) {
    if (o.regex.test(d.favorecido)) {
      return {
        despesa: { ...d, tpDocFav: "CNPJ", nrDocFav: o.cnpj, favorecido: o.nome },
        ajuste: { aplicado: true, motivo: o.motivo },
      };
    }
  }
  return { despesa: d, ajuste: { aplicado: false } };
}
