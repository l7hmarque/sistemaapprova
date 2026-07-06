/**
 * CRUD de regras de despesa por organização.
 * Autenticado — o middleware injeta o supabase escopado no usuário e RLS
 * cuida do escopo por organização.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RegraDespesa } from "@/lib/sit/regrasDespesa";

const RegraInput = z.object({
  nome: z.string().min(1).max(120),
  prioridade: z.number().int().min(0).max(9999).default(100),
  ativo: z.boolean().default(true),
  match_tp_despesa: z.number().int().nullable().optional(),
  match_tp_documento: z.number().int().nullable().optional(),
  match_favorecido_regex: z.string().max(500).nullable().optional(),
  set_cd_modalidade: z.number().int().nullable().optional(),
  set_tp_documento_pagamento: z.number().int().nullable().optional(),
  set_tp_documento_favorecido: z.string().max(10).nullable().optional(),
  set_nr_documento_favorecido: z.string().max(30).nullable().optional(),
  set_nm_favorecido: z.string().max(250).nullable().optional(),
  set_tp_despesa: z.number().int().nullable().optional(),
});

export const listarRegrasDespesa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<RegraDespesa[]> => {
    const { data: rows, error } = await context.supabase
      .from("regras_despesa")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("prioridade", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as RegraDespesa[];
  });

export const criarRegraDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ organizationId: z.string().uuid(), regra: RegraInput })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("regras_despesa").insert({
      ...data.regra,
      organization_id: data.organizationId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const atualizarRegraDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), regra: RegraInput }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("regras_despesa")
      .update(data.regra)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirRegraDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("regras_despesa")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
