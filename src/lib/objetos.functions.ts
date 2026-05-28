import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ObjetoSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  descricao: z.string().min(1).max(500),
  unidade_padrao: z.string().max(60).nullish(),
  categoria: z.string().max(120).nullish(),
});

export const listarObjetos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("objetos_cotacao")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("uso_count", { ascending: false })
      .order("descricao", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const salvarObjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ObjetoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      descricao: data.descricao.trim(),
      unidade_padrao: data.unidade_padrao || null,
      categoria: data.categoria || null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("objetos_cotacao")
        .update(payload)
        .eq("id", data.id)
        .eq("organization_id", data.organization_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("objetos_cotacao")
      .insert({ ...payload, organization_id: data.organization_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerObjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("objetos_cotacao")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
