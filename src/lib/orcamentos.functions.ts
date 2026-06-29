import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ABA_MAPA,
  ABA_ORC,
  expandirLinhasItens,
  getFirstSheetId,
  MAPA_MODEL,
  ORC_MODEL,
  renameSheet,
  sheetsValuesBatchUpdate,
  driveCopyFile,
  TEMPLATE_MAPA_ID,
  TEMPLATE_ORCAMENTO_ID,
} from "./orcamentos.server";
import { ensureMesFolder } from "./drive-org.server";

/* ============================ SCHEMAS ============================ */

const ItemOrcamentoSchema = z.object({
  descricao: z.string().min(1).max(2000),
  qtd: z.number().min(0),
  unidade: z.string().max(60).default(""),
  precoUnitario: z.number().min(0).default(0),
});

const DadosOrcamentoSchema = z.object({
  entidade: z.object({
    razao: z.string().max(255).default(""),
    cnpj: z.string().max(40).default(""),
    representante: z.string().max(255).default(""),
    cpf: z.string().max(40).default(""),
  }),
  termo: z.string().max(120).default(""),
  fornecedor: z.object({
    razao: z.string().min(1).max(255),
    cnpj: z.string().min(1).max(40),
    representante: z.string().max(255).default(""),
    cpf: z.string().max(40).default(""),
  }),
  objeto: z.string().min(1).max(500),
  validadeDias: z.number().min(1).max(365).default(30),
  data: z.string().max(20).default(""), // dd/mm/aaaa
  mesReferencia: z.string().max(7).optional(),
  itens: z.array(ItemOrcamentoSchema).min(1).max(200),
});

const FornecedorMapaSchema = z.object({
  razao: z.string().max(255).default(""),
  cnpj: z.string().max(40).default(""),
  dataEmissao: z.string().max(20).default(""),
  dataValidade: z.string().max(20).default(""),
  prazoDias: z.number().min(0).default(0),
});

const ItemMapaSchema = z.object({
  descricao: z.string().min(1).max(2000),
  unidade: z.string().max(60).default(""),
  qtd: z.number().min(0),
  precos: z.tuple([z.number().min(0), z.number().min(0), z.number().min(0)]),
});

const DadosMapaSchema = z.object({
  entidade: z.object({
    razao: z.string().max(255).default(""),
    cnpj: z.string().max(40).default(""),
    representante: z.string().max(255).default(""),
    cpf: z.string().max(40).default(""),
  }),
  termo: z.string().max(120).default(""),
  objeto: z.string().min(1).max(500),
  mesReferencia: z.string().max(7).optional(),
  fornecedores: z.tuple([FornecedorMapaSchema, FornecedorMapaSchema, FornecedorMapaSchema]),
  itens: z.array(ItemMapaSchema).min(1).max(500),
});

/* ============================ HELPERS ============================ */

function sanitizarNome(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function pastaOrcamentoMes(orgId: string, mesRef: string | undefined): Promise<string[] | undefined> {
  try {
    const id = await ensureMesFolder(orgId, "Orçamentos", mesRef ?? null);
    return id ? [id] : undefined;
  } catch (e) {
    console.warn("ensureMesFolder Orçamentos falhou:", e);
    return undefined;
  }
}

async function pastaCotacaoMes(orgId: string, mesRef: string | undefined): Promise<string[] | undefined> {
  try {
    const id = await ensureMesFolder(orgId, "Cotações", mesRef ?? null);
    return id ? [id] : undefined;
  } catch (e) {
    console.warn("ensureMesFolder Cotações falhou:", e);
    return undefined;
  }
}

/* ============================ GERAR ORÇAMENTO ============================ */

async function carregarModeloAtivo(
  supabase: SupabaseClient,
  tipo: "orcamento" | "mapa" | "controle_bancario",
) {
  const { data } = await supabase
    .from("modelos_planilha")
    .select("template_id, aba, params")
    .eq("tipo", tipo)
    .eq("ativo", true)
    .maybeSingle();
  return data as { template_id: string; aba: string; params: any } | null;
}

export const gerarOrcamentoNoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DadosOrcamentoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = await resolverOrgId(supabase);
    const modelo = await carregarModeloAtivo(supabase, "orcamento");
    const templateId = modelo?.template_id || TEMPLATE_ORCAMENTO_ID;
    const aba = modelo?.aba || ABA_ORC;
    const M = { ...ORC_MODEL, ...(modelo?.params ?? {}) };

    const parents = await pastaOrcamentoMes(orgId, data.mesReferencia);
    const nome = sanitizarNome(
      `Orcamento - ${data.objeto} - ${data.fornecedor.razao} - ${data.data || new Date().toLocaleDateString("pt-BR")}`,
    );

    const copy = await driveCopyFile({ templateId, name: nome, parents });
    const { sheetId } = await getFirstSheetId(copy.id);
    try { await renameSheet(copy.id, sheetId, aba); } catch { /* nome pode falhar se já existir */ }

    await expandirLinhasItens({
      spreadsheetId: copy.id,
      sheetId,
      linhaPrimeiroItem0: M.linhaPrimeiroItem1 - 1,
      qtdLinhasExistentes: M.qtdLinhasExistentes,
      linhaTotais0: M.linhaTotais1 - 1,
      qtdNecessaria: data.itens.length,
      colCount: M.colCount,
    });

    const updates: Array<{ range: string; values: (string | number | null)[][] }> = [
      { range: `${aba}!C7`, values: [[data.entidade.razao]] },
      { range: `${aba}!H7`, values: [[data.entidade.representante]] },
      { range: `${aba}!C8`, values: [[data.entidade.cnpj]] },
      { range: `${aba}!H8`, values: [[data.entidade.cpf]] },
      { range: `${aba}!C9`, values: [[data.fornecedor.razao]] },
      { range: `${aba}!H9`, values: [[data.fornecedor.representante]] },
      { range: `${aba}!C10`, values: [[data.fornecedor.cnpj]] },
      { range: `${aba}!H10`, values: [[data.fornecedor.cpf]] },
      { range: `${aba}!C11`, values: [[data.objeto]] },
      { range: `${aba}!I11`, values: [[data.validadeDias]] },
      { range: `${aba}!K11`, values: [[data.data]] },
      { range: `${aba}!E12`, values: [[data.termo]] },
    ];

    // Itens: A=número, B=descrição, H=qtd, I=unidade, J=preço unit
    const linha0 = M.linhaPrimeiroItem1;
    data.itens.forEach((it, i) => {
      const linha = linha0 + i;
      updates.push({ range: `${aba}!A${linha}`, values: [[i + 1]] });
      updates.push({ range: `${aba}!B${linha}`, values: [[it.descricao]] });
      updates.push({ range: `${aba}!H${linha}`, values: [[it.qtd]] });
      updates.push({ range: `${aba}!I${linha}`, values: [[it.unidade]] });
      updates.push({ range: `${aba}!J${linha}`, values: [[it.precoUnitario]] });
    });

    await sheetsValuesBatchUpdate(copy.id, updates);

    // Salva snapshot
    await supabase.from("orcamentos_salvos").insert({
      organization_id: orgId,
      tipo: "cotacao",
      objeto: data.objeto,
      termo: data.termo,
      mes_referencia: data.mesReferencia ?? null,
      fornecedor_id: null,
      dados: data,
      drive_file_id: copy.id,
      drive_file_url: copy.webViewLink,
    });

    await registrarObjeto(supabase, orgId, data.objeto);

    return { fileId: copy.id, url: copy.webViewLink, nome: copy.name };
  });

/* ============================ GERAR MAPA ============================ */

export const gerarMapaComparativoNoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DadosMapaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = await resolverOrgId(supabase);
    const modelo = await carregarModeloAtivo(supabase, "mapa");
    const templateId = modelo?.template_id || TEMPLATE_MAPA_ID;
    const aba = modelo?.aba || ABA_MAPA;
    const M = { ...MAPA_MODEL, ...(modelo?.params ?? {}) };

    const parents = await pastaCotacaoMes(orgId, data.mesReferencia);
    const nome = sanitizarNome(
      `MapaComparativo - ${data.objeto} - ${new Date().toLocaleDateString("pt-BR")}`,
    );

    const copy = await driveCopyFile({ templateId, name: nome, parents });
    const { sheetId } = await getFirstSheetId(copy.id);
    try { await renameSheet(copy.id, sheetId, aba); } catch { /* */ }

    await expandirLinhasItens({
      spreadsheetId: copy.id,
      sheetId,
      linhaPrimeiroItem0: M.linhaPrimeiroItem1 - 1,
      qtdLinhasExistentes: M.qtdLinhasExistentes,
      linhaTotais0: M.linhaTotais1 - 1,
      qtdNecessaria: data.itens.length,
      colCount: M.colCount,
    });

    const updates: Array<{ range: string; values: (string | number | null)[][] }> = [
      { range: `${aba}!C6`, values: [[data.entidade.razao]] },
      { range: `${aba}!K6`, values: [[data.entidade.representante]] },
      { range: `${aba}!C7`, values: [[data.entidade.cnpj]] },
      { range: `${aba}!K7`, values: [[data.entidade.cpf]] },
      { range: `${aba}!C8`, values: [[data.termo]] },
      { range: `${aba}!C9`, values: [[data.objeto]] },
    ];

    data.fornecedores.forEach((f, i) => {
      const linha = 13 + i;
      updates.push({ range: `${aba}!A${linha}`, values: [[f.razao]] });
      updates.push({ range: `${aba}!F${linha}`, values: [[f.cnpj]] });
      updates.push({ range: `${aba}!H${linha}`, values: [[f.dataEmissao]] });
      updates.push({ range: `${aba}!J${linha}`, values: [[f.dataValidade]] });
      updates.push({ range: `${aba}!L${linha}`, values: [[f.prazoDias]] });
    });

    updates.push({ range: `${aba}!E17`, values: [[data.fornecedores[0].razao]] });
    updates.push({ range: `${aba}!G17`, values: [[data.fornecedores[1].razao]] });
    updates.push({ range: `${aba}!I17`, values: [[data.fornecedores[2].razao]] });

    const linha0 = M.linhaPrimeiroItem1;
    data.itens.forEach((it, i) => {
      const linha = linha0 + i;
      updates.push({ range: `${aba}!A${linha}`, values: [[i + 1]] });
      updates.push({ range: `${aba}!B${linha}`, values: [[it.descricao]] });
      updates.push({ range: `${aba}!C${linha}`, values: [[it.unidade]] });
      updates.push({ range: `${aba}!D${linha}`, values: [[it.qtd]] });
      updates.push({ range: `${aba}!E${linha}`, values: [[it.precos[0] || 0]] });
      updates.push({ range: `${aba}!G${linha}`, values: [[it.precos[1] || 0]] });
      updates.push({ range: `${aba}!I${linha}`, values: [[it.precos[2] || 0]] });
    });

    await sheetsValuesBatchUpdate(copy.id, updates);

    await supabase.from("orcamentos_salvos").insert({
      organization_id: orgId,
      tipo: "mapa_comparativo",
      objeto: data.objeto,
      termo: data.termo,
      mes_referencia: data.mesReferencia ?? null,
      fornecedor_id: null,
      dados: data,
      drive_file_id: copy.id,
      drive_file_url: copy.webViewLink,
    });

    await registrarObjeto(supabase, orgId, data.objeto);

    return { fileId: copy.id, url: copy.webViewLink, nome: copy.name };
  });


async function resolverOrgId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_org");
  if (error || !data) throw new Error("Organização ativa não encontrada para o usuário");
  return data as unknown as string;
}

async function registrarObjeto(
  supabase: SupabaseClient,
  orgId: string,
  descricao: string,
): Promise<void> {
  const d = descricao.trim();
  if (!d) return;
  const { error } = await supabase
    .from("objetos_cotacao")
    .insert({ organization_id: orgId, descricao: d, uso_count: 1 });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("registrarObjeto:", error.message);
  }
}

