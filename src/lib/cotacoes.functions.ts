import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";
import {
  ABA_MAPA,
  driveCopyFile,
  ensureFolderPath,
  expandirLinhasItens,
  getFirstSheetId,
  MAPA_MODEL,
  renameSheet,
  sheetsValuesBatchUpdate,
  TEMPLATE_MAPA_ID,
} from "./orcamentos.server";
import { criarSheetOrcamentoCotacao, ENTIDADE_DEFAULT } from "./cotacoes.server";

/* ============================ SCHEMAS ============================ */

const ItemSchema = z.object({
  descricao: z.string().min(1).max(2000),
  qtd: z.number().min(0).default(0),
  unidade: z.string().max(60).default(""),
});

const CotacaoCreateSchema = z.object({
  organization_id: z.string().uuid(),
  objeto: z.string().min(1).max(500),
  termo: z.string().max(120).default(""),
  mes_referencia: z.string().max(7).optional(),
  itens: z.array(ItemSchema).min(1).max(200),
  observacoes: z.string().max(2000).optional(),
});

const CotacaoUpdateSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  objeto: z.string().min(1).max(500).optional(),
  termo: z.string().max(120).optional(),
  mes_referencia: z.string().max(7).optional(),
  itens: z.array(ItemSchema).optional(),
  status: z.enum(["coletando", "pronto_para_mapa", "finalizado"]).optional(),
  observacoes: z.string().max(2000).nullish(),
});

const OrgScopedId = z.object({ id: z.string().uuid(), organization_id: z.string().uuid() });
const OrgOnly = z.object({ organization_id: z.string().uuid() });

// ENTIDADE_DEFAULT importado de ./cotacoes.server


function pastaDestino(mesRef: string | undefined): string[] {
  const mes = mesRef && /^\d{4}-\d{2}$/.test(mesRef) ? mesRef : new Date().toISOString().slice(0, 7);
  return ["Orcamentos SIT", mes];
}

function sanitizarNome(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function safeFolder(parts: string[]): Promise<string[] | undefined> {
  try {
    const id = await ensureFolderPath(parts);
    return id ? [id] : undefined;
  } catch (e) {
    console.warn("ensureFolderPath falhou:", e);
    return undefined;
  }
}

async function carregarModeloAtivo(tipo: "orcamento" | "mapa") {
  const { data } = await supabase
    .from("modelos_planilha")
    .select("template_id, aba, params")
    .eq("tipo", tipo)
    .eq("ativo", true)
    .maybeSingle();
  return data as { template_id: string; aba: string; params: any } | null;
}

/* ============================ COTAÇÕES ============================ */

export const criarCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CotacaoCreateSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabase
      .from("cotacoes")
      .insert({
        objeto: data.objeto,
        termo: data.termo || null,
        mes_referencia: data.mes_referencia || null,
        itens: data.itens,
        observacoes: data.observacoes || null,
        status: "coletando",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listarCotacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async () => {
  const { data, error } = await supabase
    .from("cotacoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const obterCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: cot, error } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: orcs } = await supabase
      .from("orcamentos_salvos")
      .select("*")
      .eq("cotacao_id", data.id)
      .order("criado_em", { ascending: true });
    return { cotacao: cot, orcamentos: orcs ?? [] };
  });

export const atualizarCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CotacaoUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const patch: any = {};
    if (rest.objeto !== undefined) patch.objeto = rest.objeto;
    if (rest.termo !== undefined) patch.termo = rest.termo || null;
    if (rest.mes_referencia !== undefined) patch.mes_referencia = rest.mes_referencia || null;
    if (rest.itens !== undefined) patch.itens = rest.itens;
    if (rest.status !== undefined) patch.status = rest.status;
    if (rest.observacoes !== undefined) patch.observacoes = rest.observacoes || null;
    const { data: row, error } = await supabase
      .from("cotacoes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("cotacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ ORÇAMENTO POR FORNECEDOR ============================ */

const GerarOrcCotacaoSchema = z.object({
  cotacao_id: z.string().uuid(),
  fornecedor: z.object({
    razao: z.string().min(1).max(255),
    cnpj: z.string().min(1).max(40),
    representante: z.string().max(255).default(""),
    cpf: z.string().max(40).default(""),
  }),
  precosUnitarios: z.array(z.number().min(0)).min(1).max(200),
  data: z.string().max(20).default(""),
  validadeDias: z.number().min(1).max(365).default(30),
});

export const gerarOrcamentoParaCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarOrcCotacaoSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: cot, error: errCot } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("id", data.cotacao_id)
      .single();
    if (errCot || !cot) throw new Error("Cotação não encontrada");

    const itens = (cot.itens as Array<{ descricao: string; qtd: number; unidade: string }>) ?? [];
    const modelo = await carregarModeloAtivo("orcamento");

    const { fileId, url, nome, snapshot } = await criarSheetOrcamentoCotacao({
      cotacao: {
        id: cot.id,
        objeto: cot.objeto,
        termo: cot.termo,
        mes_referencia: cot.mes_referencia,
        itens,
      },
      fornecedor: data.fornecedor,
      precosUnitarios: data.precosUnitarios,
      data: data.data,
      validadeDias: data.validadeDias,
      modelo,
    });

    const { data: orcRow, error: errOrc } = await supabase
      .from("orcamentos_salvos")
      .insert({
        tipo: "cotacao",
        objeto: cot.objeto,
        termo: cot.termo,
        mes_referencia: cot.mes_referencia,
        cotacao_id: cot.id,
        status: "preenchido",
        fornecedor_id: null,
        dados: snapshot,
        drive_file_id: fileId,
        drive_file_url: url,
      })
      .select()
      .single();
    if (errOrc) throw new Error(errOrc.message);

    return { fileId, url, nome, orcamento: orcRow };
  });

export const removerOrcamentoCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("orcamentos_salvos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ MAPA COMPARATIVO ============================ */

const GerarMapaSchema = z.object({
  cotacao_id: z.string().uuid(),
  orcamento_ids: z.array(z.string().uuid()).length(3),
});

export const gerarMapaDaCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarMapaSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: cot, error: errCot } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("id", data.cotacao_id)
      .single();
    if (errCot || !cot) throw new Error("Cotação não encontrada");

    const { data: orcs, error: errOrc } = await supabase
      .from("orcamentos_salvos")
      .select("*")
      .in("id", data.orcamento_ids);
    if (errOrc || !orcs || orcs.length !== 3) {
      throw new Error("Selecione exatamente 3 orçamentos preenchidos.");
    }

    const itensCot = (cot.itens as Array<{ descricao: string; qtd: number; unidade: string }>) ?? [];

    // Ordena na ordem do input
    const orcsOrdenados = data.orcamento_ids.map((id) => orcs.find((o) => o.id === id)!);

    const fornecedores = orcsOrdenados.map((o) => {
      const d = o.dados as any;
      return {
        razao: d?.fornecedor?.razao ?? "",
        cnpj: d?.fornecedor?.cnpj ?? "",
        dataEmissao: d?.data ?? "",
        dataValidade: "",
        prazoDias: d?.validadeDias ?? 0,
      };
    }) as [any, any, any];

    const itensMapa = itensCot.map((it, i) => {
      const precos = orcsOrdenados.map((o) => {
        const items = ((o.dados as any)?.itens ?? []) as Array<{ precoUnitario?: number }>;
        return Number(items[i]?.precoUnitario ?? 0);
      }) as [number, number, number];
      return {
        descricao: it.descricao,
        unidade: it.unidade ?? "",
        qtd: it.qtd ?? 0,
        precos,
      };
    });

    const modelo = await carregarModeloAtivo("mapa");
    const templateId = modelo?.template_id || TEMPLATE_MAPA_ID;
    const aba = modelo?.aba || ABA_MAPA;
    const M = { ...MAPA_MODEL, ...(modelo?.params ?? {}) };

    const parents = await safeFolder(pastaDestino(cot.mes_referencia ?? undefined));
    const nome = sanitizarNome(
      `MapaComparativo - ${cot.objeto} - ${new Date().toLocaleDateString("pt-BR")}`,
    );

    const copy = await driveCopyFile({ templateId, name: nome, parents });
    const { sheetId } = await getFirstSheetId(copy.id);
    try {
      await renameSheet(copy.id, sheetId, aba);
    } catch {
      /* */
    }

    await expandirLinhasItens({
      spreadsheetId: copy.id,
      sheetId,
      linhaPrimeiroItem0: M.linhaPrimeiroItem1 - 1,
      qtdLinhasExistentes: M.qtdLinhasExistentes,
      linhaTotais0: M.linhaTotais1 - 1,
      qtdNecessaria: itensMapa.length,
      colCount: M.colCount,
    });

    const updates: Array<{ range: string; values: (string | number | null)[][] }> = [
      { range: `${aba}!C6`, values: [[ENTIDADE_DEFAULT.razao]] },
      { range: `${aba}!K6`, values: [[ENTIDADE_DEFAULT.representante]] },
      { range: `${aba}!C7`, values: [[ENTIDADE_DEFAULT.cnpj]] },
      { range: `${aba}!K7`, values: [[ENTIDADE_DEFAULT.cpf]] },
      { range: `${aba}!C8`, values: [[cot.termo ?? ""]] },
      { range: `${aba}!C9`, values: [[cot.objeto]] },
    ];

    fornecedores.forEach((f: any, i: number) => {
      const linha = 13 + i;
      updates.push({ range: `${aba}!A${linha}`, values: [[f.razao]] });
      updates.push({ range: `${aba}!F${linha}`, values: [[f.cnpj]] });
      updates.push({ range: `${aba}!H${linha}`, values: [[f.dataEmissao]] });
      updates.push({ range: `${aba}!J${linha}`, values: [[f.dataValidade]] });
      updates.push({ range: `${aba}!L${linha}`, values: [[f.prazoDias]] });
    });

    updates.push({ range: `${aba}!E17`, values: [[fornecedores[0].razao]] });
    updates.push({ range: `${aba}!G17`, values: [[fornecedores[1].razao]] });
    updates.push({ range: `${aba}!I17`, values: [[fornecedores[2].razao]] });

    const linha0 = M.linhaPrimeiroItem1;
    itensMapa.forEach((it, i) => {
      const linha = linha0 + i;
      updates.push({ range: `${aba}!A${linha}`, values: [[i + 1]] });
      updates.push({ range: `${aba}!B${linha}`, values: [[it.descricao]] });
      updates.push({ range: `${aba}!C${linha}`, values: [[it.unidade]] });
      updates.push({ range: `${aba}!D${linha}`, values: [[it.qtd]] });
      updates.push({ range: `${aba}!E${linha}`, values: [[it.precos[0]]] });
      updates.push({ range: `${aba}!G${linha}`, values: [[it.precos[1]]] });
      updates.push({ range: `${aba}!I${linha}`, values: [[it.precos[2]]] });
    });

    await sheetsValuesBatchUpdate(copy.id, updates);

    await supabase.from("orcamentos_salvos").insert({
      tipo: "mapa_comparativo",
      objeto: cot.objeto,
      termo: cot.termo,
      mes_referencia: cot.mes_referencia,
      cotacao_id: cot.id,
      status: "finalizado",
      fornecedor_id: null,
      dados: { fornecedores, itens: itensMapa },
      drive_file_id: copy.id,
      drive_file_url: copy.webViewLink,
    });

    await supabase
      .from("cotacoes")
      .update({
        status: "finalizado",
        mapa_drive_file_id: copy.id,
        mapa_drive_file_url: copy.webViewLink,
      })
      .eq("id", cot.id);

    return { fileId: copy.id, url: copy.webViewLink };
  });

/* ============================ PRESETS ============================ */

const PresetSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(255),
  objeto: z.string().max(500).nullish(),
  termo: z.string().max(120).nullish(),
  itens: z.array(ItemSchema).min(1).max(200),
  fornecedores_sugeridos: z
    .array(
      z.object({
        razao: z.string().max(255),
        cnpj: z.string().max(40),
        representante: z.string().max(255).optional(),
        cpf: z.string().max(40).optional(),
      }),
    )
    .max(20)
    .default([]),
});

export const listarPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async () => {
  const { data, error } = await supabase
    .from("cotacao_presets")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const salvarPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PresetSchema.parse(d))
  .handler(async ({ data }) => {
    const payload = {
      nome: data.nome,
      objeto: data.objeto || null,
      termo: data.termo || null,
      itens: data.itens,
      fornecedores_sugeridos: data.fornecedores_sugeridos,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("cotacao_presets")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("cotacao_presets")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("cotacao_presets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const criarCotacaoDePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ preset_id: z.string().uuid(), mes_referencia: z.string().max(7).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: preset, error } = await supabase
      .from("cotacao_presets")
      .select("*")
      .eq("id", data.preset_id)
      .single();
    if (error || !preset) throw new Error("Modelo não encontrado");

    const mes = data.mes_referencia || new Date().toISOString().slice(0, 7);

    const { data: cot, error: errCot } = await supabase
      .from("cotacoes")
      .insert({
        objeto: preset.objeto || preset.nome,
        termo: preset.termo,
        mes_referencia: mes,
        itens: preset.itens,
        status: "coletando",
      })
      .select()
      .single();
    if (errCot) throw new Error(errCot.message);

    return { cotacao: cot, fornecedores_sugeridos: preset.fornecedores_sugeridos };
  });
