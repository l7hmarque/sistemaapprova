import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgInput = z.object({ organization_id: z.string().uuid() });
const IdInput = z.object({ id: z.string().uuid() });

const StatusProjeto = z.enum(["ativo", "encerrado", "cancelado"]);

const ProjetoCreateSchema = OrgInput.extend({
  nome: z.string().min(1).max(200),
  numero_termo: z.string().max(200).optional(),
  orgao_concedente: z.string().max(200).optional(),
  objeto: z.string().max(2000).optional(),
  valor_total: z.number().min(0).optional(),
  vigencia_inicio: z.string().optional(),
  vigencia_fim: z.string().optional(),
  status: StatusProjeto.optional(),
});

const ProjetoUpdateSchema = IdInput.extend({
  nome: z.string().min(1).max(200).optional(),
  numero_termo: z.string().max(200).optional(),
  orgao_concedente: z.string().max(200).optional(),
  objeto: z.string().max(2000).optional(),
  valor_total: z.number().min(0).optional(),
  vigencia_inicio: z.string().optional(),
  vigencia_fim: z.string().optional(),
  status: StatusProjeto.optional(),
});

/** Lista todos os projetos da organização. */
export const listarProjetos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("projetos")
      .select("id, nome, numero_termo, orgao_concedente, objeto, valor_total, vigencia_inicio, vigencia_fim, status, criado_em, atualizado_em")
      .eq("organization_id", data.organization_id)
      .order("status", { ascending: false })
      .order("nome");
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

/** Busca um projeto pelo ID. */
export const buscarProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projetos")
      .select("id, nome, numero_termo, orgao_concedente, objeto, valor_total, vigencia_inicio, vigencia_fim, status, criado_em, atualizado_em, organization_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as any;
  });

/** Cria um novo projeto. */
export const criarProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjetoCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      organization_id: data.organization_id,
      nome: data.nome,
      numero_termo: data.numero_termo ?? null,
      orgao_concedente: data.orgao_concedente ?? null,
      objeto: data.objeto ?? null,
      valor_total: data.valor_total ?? null,
      vigencia_inicio: data.vigencia_inicio ?? null,
      vigencia_fim: data.vigencia_fim ?? null,
      status: data.status ?? "ativo",
    };
    const { data: ins, error } = await context.supabase
      .from("projetos")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

/** Atualiza um projeto existente. */
export const atualizarProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjetoUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const row: any = {};
    if (rest.nome !== undefined) row.nome = rest.nome;
    if (rest.numero_termo !== undefined) row.numero_termo = rest.numero_termo ?? null;
    if (rest.orgao_concedente !== undefined) row.orgao_concedente = rest.orgao_concedente ?? null;
    if (rest.objeto !== undefined) row.objeto = rest.objeto ?? null;
    if (rest.valor_total !== undefined) row.valor_total = rest.valor_total ?? null;
    if (rest.vigencia_inicio !== undefined) row.vigencia_inicio = rest.vigencia_inicio ?? null;
    if (rest.vigencia_fim !== undefined) row.vigencia_fim = rest.vigencia_fim ?? null;
    if (rest.status !== undefined) row.status = rest.status;

    const { error } = await context.supabase
      .from("projetos")
      .update(row)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui um projeto (somente se não tiver vínculos). */
export const excluirProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const tabelas: { nome: "eventos_financeiros" | "cotacoes" | "orcamentos_salvos" | "repasses_recebidos" | "plano_aplicacao"; campo: "projeto_id" }[] = [
      { nome: "eventos_financeiros", campo: "projeto_id" },
      { nome: "cotacoes", campo: "projeto_id" },
      { nome: "orcamentos_salvos", campo: "projeto_id" },
      { nome: "repasses_recebidos", campo: "projeto_id" },
      { nome: "plano_aplicacao", campo: "projeto_id" },
    ];
    for (const t of tabelas) {
      const { count, error } = await context.supabase
        .from(t.nome)
        .select("*", { count: "exact", head: true })
        .eq(t.campo, data.id);
      if (error) throw new Error(error.message);
      if ((count ?? 0) > 0) {
        throw new Error(`Não é possível excluir: existem vínculos em ${t.nome}.`);
      }
    }
    const { error } = await context.supabase.from("projetos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Resumo de execução orçamentária de um projeto. */
export const resumoExecucaoProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    IdInput.extend({ mes_referencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: projeto, error: errProj } = await context.supabase
      .from("projetos")
      .select("id, nome, numero_termo, orgao_concedente, objeto, valor_total, vigencia_inicio, vigencia_fim, status")
      .eq("id", data.id)
      .single();
    if (errProj) throw new Error(errProj.message);

    let qRepasses = context.supabase
      .from("repasses_recebidos")
      .select("valor")
      .eq("projeto_id", data.id);
    if (data.mes_referencia) qRepasses = qRepasses.eq("mes_referencia", data.mes_referencia);

    const { data: repasses, error: errRepasses } = await qRepasses;
    if (errRepasses) throw new Error(errRepasses.message);

    let qEventos = context.supabase
      .from("eventos_financeiros")
      .select("valor_efetivo, natureza_despesa_codigo, categoria")
      .eq("projeto_id", data.id)
      .is("excluido_em", null);
    if (data.mes_referencia) qEventos = qEventos.eq("mes_referencia", data.mes_referencia);

    const { data: eventos, error: errEventos } = await qEventos;
    if (errEventos) throw new Error(errEventos.message);

    const totalRepassado = (repasses ?? []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const totalExecutado = (eventos ?? []).reduce((s: number, e: any) => s + Number(e.valor_efetivo || 0), 0);
    const saldo = Number(projeto.valor_total || 0) - totalExecutado;

    const porNatureza: Record<string, { codigo: string; total: number }> = {};
    for (const e of eventos ?? []) {
      const cod = e.natureza_despesa_codigo || "sem_natureza";
      if (!porNatureza[cod]) porNatureza[cod] = { codigo: cod, total: 0 };
      porNatureza[cod].total += Number(e.valor_efetivo || 0);
    }

    return {
      projeto,
      totalRepassado,
      totalExecutado,
      saldo,
      porNatureza: Object.values(porNatureza),
    };
  });

/** Lista projetos com resumo financeiro simplificado para dashboards. */
export const listarProjetosComResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.extend({ mes_referencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: projetos, error } = await context.supabase
      .from("projetos")
      .select("id, nome, numero_termo, valor_total, status")
      .eq("organization_id", data.organization_id)
      .order("nome");
    if (error) throw new Error(error.message);

    const ids = (projetos ?? []).map((p: any) => p.id);
    if (!ids.length) return [];

    let qRepasses = context.supabase
      .from("repasses_recebidos")
      .select("projeto_id, valor")
      .in("projeto_id", ids);
    if (data.mes_referencia) qRepasses = qRepasses.eq("mes_referencia", data.mes_referencia);

    const { data: repasses, error: errRepasses } = await qRepasses;
    if (errRepasses) throw new Error(errRepasses.message);

    let qEventos = context.supabase
      .from("eventos_financeiros")
      .select("projeto_id, valor_efetivo")
      .in("projeto_id", ids)
      .is("excluido_em", null);
    if (data.mes_referencia) qEventos = qEventos.eq("mes_referencia", data.mes_referencia);

    const { data: eventos, error: errEventos } = await qEventos;
    if (errEventos) throw new Error(errEventos.message);

    const repPorProj = new Map<string, number>();
    for (const r of repasses ?? []) {
      repPorProj.set(r.projeto_id, (repPorProj.get(r.projeto_id) || 0) + Number(r.valor || 0));
    }
    const execPorProj = new Map<string, number>();
    for (const e of eventos ?? []) {
      execPorProj.set(e.projeto_id, (execPorProj.get(e.projeto_id) || 0) + Number(e.valor_efetivo || 0));
    }

    return (projetos ?? []).map((p: any) => ({
      ...p,
      totalRepassado: repPorProj.get(p.id) || 0,
      totalExecutado: execPorProj.get(p.id) || 0,
      saldo: Number(p.valor_total || 0) - (execPorProj.get(p.id) || 0),
    }));
  });