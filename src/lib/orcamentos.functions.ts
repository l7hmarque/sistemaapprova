import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  ABA_MAPA,
  ABA_ORC,
  ensureFolderPath,
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

function pastaDestino(mesRef: string | undefined): string[] {
  const mes = (mesRef && /^\d{4}-\d{2}$/.test(mesRef))
    ? mesRef
    : new Date().toISOString().slice(0, 7);
  return ["Orcamentos SIT", mes];
}

function sanitizarNome(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/* ============================ GERAR ORÇAMENTO ============================ */

async function carregarModeloAtivo(tipo: "orcamento" | "mapa" | "controle_bancario") {
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
  .handler(async ({ data }) => {
    const modelo = await carregarModeloAtivo("orcamento");
    const templateId = modelo?.template_id || TEMPLATE_ORCAMENTO_ID;
    const aba = modelo?.aba || ABA_ORC;
    const M = { ...ORC_MODEL, ...(modelo?.params ?? {}) };

    const parents = await safeFolder(pastaDestino(data.mesReferencia));
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
      tipo: "cotacao",
      objeto: data.objeto,
      termo: data.termo,
      mes_referencia: data.mesReferencia ?? null,
      fornecedor_id: null,
      dados: data,
      drive_file_id: copy.id,
      drive_file_url: copy.webViewLink,
    });

    await registrarObjeto(data.objeto);

    return { fileId: copy.id, url: copy.webViewLink, nome: copy.name };
  });

/* ============================ GERAR MAPA ============================ */

export const gerarMapaComparativoNoDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DadosMapaSchema.parse(d))
  .handler(async ({ data }) => {
    const modelo = await carregarModeloAtivo("mapa");
    const templateId = modelo?.template_id || TEMPLATE_MAPA_ID;
    const aba = modelo?.aba || ABA_MAPA;
    const M = { ...MAPA_MODEL, ...(modelo?.params ?? {}) };

    const parents = await safeFolder(pastaDestino(data.mesReferencia));
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

    // Fornecedores nas linhas 13,14,15: A=razão, F=CNPJ, H=data emissão, J=validade, L=prazo
    data.fornecedores.forEach((f, i) => {
      const linha = 13 + i;
      updates.push({ range: `${aba}!A${linha}`, values: [[f.razao]] });
      updates.push({ range: `${aba}!F${linha}`, values: [[f.cnpj]] });
      updates.push({ range: `${aba}!H${linha}`, values: [[f.dataEmissao]] });
      updates.push({ range: `${aba}!J${linha}`, values: [[f.dataValidade]] });
      updates.push({ range: `${aba}!L${linha}`, values: [[f.prazoDias]] });
    });

    // Nomes dos fornecedores no header dos preços (linha 17, cols E, G, I)
    updates.push({ range: `${aba}!E17`, values: [[data.fornecedores[0].razao]] });
    updates.push({ range: `${aba}!G17`, values: [[data.fornecedores[1].razao]] });
    updates.push({ range: `${aba}!I17`, values: [[data.fornecedores[2].razao]] });

    // Itens: A=item, B=descrição, C=unidade, D=qtd, E/G/I=preço unit
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
      tipo: "mapa_comparativo",
      objeto: data.objeto,
      termo: data.termo,
      mes_referencia: data.mesReferencia ?? null,
      fornecedor_id: null,
      dados: data,
      drive_file_id: copy.id,
      drive_file_url: copy.webViewLink,
    });

    await registrarObjeto(data.objeto);

    return { fileId: copy.id, url: copy.webViewLink, nome: copy.name };
  });

async function safeFolder(parts: string[]): Promise<string[] | undefined> {
  try {
    const id = await ensureFolderPath(parts);
    return id ? [id] : undefined;
  } catch (e) {
    console.warn("ensureFolderPath falhou, usando raiz do Drive:", e);
    return undefined;
  }
}

async function registrarObjeto(descricao: string): Promise<void> {
  const d = descricao.trim();
  if (!d) return;
  // Tabela tem unique index em lower(descricao); insert duplicado simplesmente falha (sem update).
  try {
    await supabase.from("objetos_cotacao").insert({ descricao: d, uso_count: 1 });
  } catch {
    /* duplicado — ignora */
  }
}
