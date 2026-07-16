/**
 * Workflow de aprovação de eventos financeiros (Milestone 2).
 *
 * Estados: rascunho → pendente_revisao → aprovado → homologado.
 * Só admin/owner aprova ou devolve; homologação é feita pelo snapshot.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OrgInput = z.object({ organization_id: z.string().uuid() });
const MesInput = OrgInput.extend({
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/),
});

async function assertAdmin(ctx: {
  supabase: any;
  userId: string;
}, orgId: string) {
  const { data, error } = await ctx.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !["owner", "admin"].includes(data.role)) {
    throw new Error("Ação restrita a administradores da organização.");
  }
}

/** Lista eventos pendentes de revisão no mês, com pendências marcadas. */
export const listarEventosPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MesInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organization_id);
    const { data: eventos, error } = await context.supabase
      .from("eventos_financeiros")
      .select(
        "id, id_interno, mes_referencia, categoria, descricao, nm_favorecido, fornecedor_id, valor_previsto, valor_efetivo, data_vencimento, data_pagamento, natureza_despesa_codigo, status_documental, status_workflow, origem"
      )
      .eq("organization_id", data.organization_id)
      .eq("mes_referencia", data.mes_referencia)
      .in("status_workflow", ["rascunho", "pendente_revisao"])
      .is("excluido_em", null)
      .order("data_vencimento", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    const ids = (eventos ?? []).map((e: any) => e.id);
    const semComprovante = new Set<string>(ids);
    if (ids.length) {
      const { data: anx } = await context.supabase
        .from("documentos_anexos")
        .select("evento_id")
        .in("evento_id", ids);
      for (const a of anx ?? []) if (a.evento_id) semComprovante.delete(a.evento_id);
    }

    return (eventos ?? []).map((e: any) => {
      const divergente =
        e.valor_previsto != null &&
        e.valor_efetivo != null &&
        Number(e.valor_previsto) > 0 &&
        Math.abs(Number(e.valor_efetivo) - Number(e.valor_previsto)) /
          Number(e.valor_previsto) > 0.1;
      return {
        ...e,
        pendencias: {
          semNatureza: !e.natureza_despesa_codigo,
          semComprovante: semComprovante.has(e.id),
          divergente,
        },
      };
    });
  });

/** Aprova um lote de eventos. */
export const aprovarEventosLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    OrgInput.extend({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organization_id);
    const { error, count } = await context.supabase
      .from("eventos_financeiros")
      .update({
        status_workflow: "aprovado",
        aprovado_por: context.userId,
        aprovado_em: new Date().toISOString(),
        devolvido_motivo: null,
      }, { count: "exact" })
      .eq("organization_id", data.organization_id)
      .in("id", data.ids)
      .in("status_workflow", ["rascunho", "pendente_revisao"])
      .is("excluido_em", null);
    if (error) throw new Error(error.message);
    return { aprovados: count ?? 0 };
  });

/** Devolve um evento para rascunho, com motivo. */
export const devolverEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    OrgInput.extend({
      id: z.string().uuid(),
      motivo: z.string().min(3).max(500),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.organization_id);
    const { error } = await context.supabase
      .from("eventos_financeiros")
      .update({
        status_workflow: "rascunho",
        devolvido_motivo: data.motivo,
        aprovado_por: null,
        aprovado_em: null,
      })
      .eq("organization_id", data.organization_id)
      .eq("id", data.id)
      .neq("status_workflow", "homologado");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Resumo do dashboard: contagens acionáveis da org. */
export const resumoDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const orgId = data.organization_id;
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const mesAnterior = (() => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    const em30 = new Date(hoje.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const hojeIso = hoje.toISOString().slice(0, 10);

    const [pendRev, semNat, pagosSemAnexo, snaps, docsVenc] = await Promise.all([
      context.supabase
        .from("eventos_financeiros")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status_workflow", ["rascunho", "pendente_revisao"])
        .is("excluido_em", null),
      context.supabase
        .from("eventos_financeiros")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status_workflow", "aprovado")
        .is("natureza_despesa_codigo", null)
        .is("excluido_em", null),
      context.supabase
        .from("eventos_financeiros")
        .select("id, data_pagamento")
        .eq("organization_id", orgId)
        .not("data_pagamento", "is", null)
        .in("status_workflow", ["aprovado", "pendente_revisao"])
        .is("excluido_em", null)
        .limit(1000),
      context.supabase
        .from("prestacoes_snapshot")
        .select("id, mes_referencia, titulo, criado_em, arquivo_url")
        .eq("organization_id", orgId)
        .is("revogado_em", null)
        .order("criado_em", { ascending: false })
        .limit(3),
      context.supabase
        .from("prestacao_documentos")
        .select("id, nome, valido_ate, data_vencimento")
        .eq("organization_id", orgId)
        .or(`valido_ate.lte.${em30},data_vencimento.lte.${em30}`)
        .limit(50),
    ]);

    let semAnexo = 0;
    if (pagosSemAnexo.data?.length) {
      const ids = pagosSemAnexo.data.map((e: any) => e.id);
      const { data: anx } = await context.supabase
        .from("documentos_anexos")
        .select("evento_id")
        .in("evento_id", ids);
      const comAnexo = new Set((anx ?? []).map((a: any) => a.evento_id));
      semAnexo = ids.filter((id: string) => !comAnexo.has(id)).length;
    }

    // Fechar mês: mês anterior sem pendências e sem snapshot ativo
    const [pendAnt, snapAnt] = await Promise.all([
      context.supabase
        .from("eventos_financeiros")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("mes_referencia", mesAnterior)
        .in("status_workflow", ["rascunho", "pendente_revisao"])
        .is("excluido_em", null),
      context.supabase
        .from("prestacoes_snapshot")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("mes_referencia", mesAnterior)
        .is("revogado_em", null),
    ]);

    const docsVencendo = (docsVenc.data ?? []).filter((d: any) => {
      const dt = d.valido_ate ?? d.data_vencimento;
      return dt && dt >= hojeIso && dt <= em30;
    });

    return {
      mesAtual,
      mesAnterior,
      pendentesRevisao: pendRev.count ?? 0,
      semNatureza: semNat.count ?? 0,
      pagosSemComprovante: semAnexo,
      docsVencendo,
      snapshots: snaps.data ?? [],
      podeFecharMesAnterior:
        (pendAnt.count ?? 0) === 0 && (snapAnt.count ?? 0) === 0,
      pendenciasMesAnterior: pendAnt.count ?? 0,
      snapshotMesAnterior: (snapAnt.count ?? 0) > 0,
    };
  });
