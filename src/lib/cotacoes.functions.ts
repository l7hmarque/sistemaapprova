import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";
import {
  ABA_MAPA,
  driveCopyFile,
  expandirLinhasItens,
  getFirstSheetId,
  MAPA_MODEL,
  renameSheet,
  sheetsValuesBatchUpdate,
  TEMPLATE_MAPA_ID,
} from "./orcamentos.server";
import { ensureMesFolder } from "./drive-org.server";
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


function sanitizarNome(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function pastaCotacoesMes(orgId: string, mesRef: string | undefined): Promise<string[] | undefined> {
  try {
    const id = await ensureMesFolder(orgId, "Cotações", mesRef ?? null);
    return id ? [id] : undefined;
  } catch (e) {
    console.warn("ensureMesFolder Cotações falhou:", e);
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
        organization_id: data.organization_id,
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

export const listarCotacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgOnly.parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const obterCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgScopedId.parse(d))
  .handler(async ({ data }) => {
    const { data: cot, error } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .single();
    if (error) throw new Error(error.message);
    const { data: orcs } = await supabase
      .from("orcamentos_salvos")
      .select("*")
      .eq("cotacao_id", data.id)
      .eq("organization_id", data.organization_id)
      .order("criado_em", { ascending: true });
    return { cotacao: cot, orcamentos: orcs ?? [] };
  });

export const atualizarCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CotacaoUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, organization_id, ...rest } = data;
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
      .eq("organization_id", organization_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgScopedId.parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("cotacoes")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ ORÇAMENTO POR FORNECEDOR ============================ */

const GerarOrcCotacaoSchema = z.object({
  organization_id: z.string().uuid(),
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
      .eq("organization_id", data.organization_id)
      .single();
    if (errCot || !cot) throw new Error("Cotação não encontrada");

    const itens = (cot.itens as Array<{ descricao: string; qtd: number; unidade: string }>) ?? [];
    const modelo = await carregarModeloAtivo("orcamento");

    const { fileId, url, nome, snapshot } = await criarSheetOrcamentoCotacao({
      orgId: data.organization_id,
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
        organization_id: data.organization_id,
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
  .inputValidator((d: unknown) => OrgScopedId.parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("orcamentos_salvos")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ MAPA COMPARATIVO ============================ */

const GerarMapaSchema = z.object({
  organization_id: z.string().uuid(),
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
      .eq("organization_id", data.organization_id)
      .single();
    if (errCot || !cot) throw new Error("Cotação não encontrada");

    const { data: orcs, error: errOrc } = await supabase
      .from("orcamentos_salvos")
      .select("*")
      .eq("organization_id", data.organization_id)
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

    const parents = await pastaCotacoesMes(data.organization_id, cot.mes_referencia ?? undefined);
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
      organization_id: data.organization_id,
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
      .eq("id", cot.id)
      .eq("organization_id", data.organization_id);

    return { fileId: copy.id, url: copy.webViewLink };
  });

/* ============================ PRESETS ============================ */

const PresetSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
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

export const listarPresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgOnly.parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabase
      .from("cotacao_presets")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
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
        .eq("organization_id", data.organization_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("cotacao_presets")
      .insert({ ...payload, organization_id: data.organization_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgScopedId.parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("cotacao_presets")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const criarCotacaoDePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        preset_id: z.string().uuid(),
        mes_referencia: z.string().max(7).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: preset, error } = await supabase
      .from("cotacao_presets")
      .select("*")
      .eq("id", data.preset_id)
      .eq("organization_id", data.organization_id)
      .single();
    if (error || !preset) throw new Error("Modelo não encontrado");

    const mes = data.mes_referencia || new Date().toISOString().slice(0, 7);

    const { data: cot, error: errCot } = await supabase
      .from("cotacoes")
      .insert({
        organization_id: data.organization_id,
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

/* ============================ RANKING / VENCEDOR / EVENTO ============================ */

function totalOrcamento(o: any): number {
  const items = ((o.dados as any)?.itens ?? []) as Array<{ precoUnitario?: number; qtd?: number; indisponivel?: boolean }>;
  return items.reduce((a, it) => {
    if (it.indisponivel) return a;
    return a + Number(it.precoUnitario || 0) * Number(it.qtd || 0);
  }, 0);
}

export const rankingCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgScopedId.parse(d))
  .handler(async ({ data }) => {
    const { data: orcs, error } = await supabase
      .from("orcamentos_salvos")
      .select("id, dados, drive_file_id, drive_file_url, criado_em")
      .eq("organization_id", data.organization_id)
      .eq("cotacao_id", data.id)
      .eq("tipo", "cotacao")
      .eq("status", "preenchido");
    if (error) throw new Error(error.message);
    return (orcs ?? [])
      .map((o) => ({
        id: o.id,
        razao: (o.dados as any)?.fornecedor?.razao ?? "",
        cnpj: (o.dados as any)?.fornecedor?.cnpj ?? "",
        total: totalOrcamento(o),
        drive_file_url: o.drive_file_url,
        criado_em: o.criado_em,
      }))
      .filter((o) => o.total > 0)
      .sort((a, b) => a.total - b.total);
  });

const GerarMapaAutoSchema = z.object({
  organization_id: z.string().uuid(),
  cotacao_id: z.string().uuid(),
});

export const gerarMapaAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarMapaAutoSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: orcs, error } = await supabase
      .from("orcamentos_salvos")
      .select("id, dados")
      .eq("organization_id", data.organization_id)
      .eq("cotacao_id", data.cotacao_id)
      .eq("tipo", "cotacao")
      .eq("status", "preenchido");
    if (error) throw new Error(error.message);
    const validos = (orcs ?? [])
      .map((o) => ({ id: o.id, total: totalOrcamento(o) }))
      .filter((o) => o.total > 0)
      .sort((a, b) => a.total - b.total);
    if (validos.length < 3) throw new Error(`Necessário 3 orçamentos preenchidos (há ${validos.length}).`);
    return { orcamento_ids: validos.slice(0, 3).map((o) => o.id) as [string, string, string] };
  });

const DefinirVencedorSchema = z.object({
  organization_id: z.string().uuid(),
  cotacao_id: z.string().uuid(),
  orcamento_id: z.string().uuid(),
});

export const definirVencedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DefinirVencedorSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabase
      .from("cotacoes")
      .update({ orcamento_vencedor_id: data.orcamento_id })
      .eq("id", data.cotacao_id)
      .eq("organization_id", data.organization_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const gerarEventoDaCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgScopedId.parse(d))
  .handler(async ({ data }) => {
    const { data: cot, error: errCot } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .single();
    if (errCot || !cot) throw new Error("Cotação não encontrada");
    if (cot.evento_financeiro_id) {
      return { evento_id: cot.evento_financeiro_id as string, ja_existia: true };
    }
    if (!cot.orcamento_vencedor_id) throw new Error("Defina o orçamento vencedor antes de lançar no financeiro.");

    const { data: vencedor, error: errV } = await supabase
      .from("orcamentos_salvos")
      .select("*")
      .eq("id", cot.orcamento_vencedor_id)
      .eq("organization_id", data.organization_id)
      .single();
    if (errV || !vencedor) throw new Error("Orçamento vencedor não encontrado");

    const total = totalOrcamento(vencedor);
    const fornecedor = (vencedor.dados as any)?.fornecedor ?? {};
    const mes = cot.mes_referencia || new Date().toISOString().slice(0, 7);

    let fornecedorId: string | null = null;
    if (fornecedor.cnpj) {
      const { data: f } = await supabase
        .from("fornecedores")
        .select("id")
        .eq("organization_id", data.organization_id)
        .eq("cnpj", fornecedor.cnpj)
        .maybeSingle();
      fornecedorId = f?.id ?? null;
    }

    const { data: evento, error: errE } = await supabase
      .from("eventos_financeiros")
      .insert({
        organization_id: data.organization_id,
        mes_referencia: mes,
        categoria: "material_consumo",
        descricao: cot.objeto,
        valor_previsto: total,
        fornecedor_id: fornecedorId,
        nm_favorecido: fornecedor.razao ?? null,
        natureza_despesa_codigo: "3.3.90.39.99",
        cd_modalidade_compra: 101,
        origem: "cotacao",
        status_workflow: "rascunho",
        metadata: {
          origem: "cotacao",
          cotacao_id: cot.id,
          orcamento_vencedor_id: vencedor.id,
          mapa_drive_file_id: cot.mapa_drive_file_id ?? null,
          origem_natureza: "regra_modalidade_101",
        },
      })
      .select()
      .single();
    if (errE) throw new Error(errE.message);

    try {
      const anexos: Array<{
        organization_id: string;
        evento_id: string;
        tipo: string;
        arquivo_url: string | null;
        drive_file_id: string | null;
        metadata: any;
      }> = [];
      if (cot.mapa_drive_file_id) {
        anexos.push({
          organization_id: data.organization_id,
          evento_id: evento.id,
          tipo: "mapa_comparativo",
          arquivo_url: cot.mapa_drive_file_url,
          drive_file_id: cot.mapa_drive_file_id,
          metadata: { origem: "cotacao", cotacao_id: cot.id },
        });
      }
      const { data: orcs3 } = await supabase
        .from("orcamentos_salvos")
        .select("id, drive_file_id, drive_file_url")
        .eq("organization_id", data.organization_id)
        .eq("cotacao_id", cot.id)
        .eq("tipo", "cotacao");
      for (const o of orcs3 ?? []) {
        if (!o.drive_file_id) continue;
        anexos.push({
          organization_id: data.organization_id,
          evento_id: evento.id,
          tipo: "orcamento",
          arquivo_url: o.drive_file_url,
          drive_file_id: o.drive_file_id,
          metadata: { origem: "cotacao", orcamento_id: o.id },
        });
      }
      if (anexos.length) {
        await supabase.from("documentos_anexos").insert(anexos);
      }
    } catch (e) {
      console.warn("[gerarEventoDaCotacao] falha ao anexar documentos:", e);
    }

    await supabase
      .from("cotacoes")
      .update({ evento_financeiro_id: evento.id })
      .eq("id", cot.id)
      .eq("organization_id", data.organization_id);

    return { evento_id: evento.id as string, ja_existia: false };
  });
