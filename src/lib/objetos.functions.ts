import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const ObjetoSchema = z.object({
  id: z.string().uuid().optional(),
  descricao: z.string().min(1).max(500),
  unidade_padrao: z.string().max(60).nullish(),
  categoria: z.string().max(120).nullish(),
});

export const listarObjetos = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabase
    .from("objetos_cotacao")
    .select("*")
    .order("uso_count", { ascending: false })
    .order("descricao", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const salvarObjeto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ObjetoSchema.parse(d))
  .handler(async ({ data }) => {
    const payload = {
      descricao: data.descricao.trim(),
      unidade_padrao: data.unidade_padrao || null,
      categoria: data.categoria || null,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("objetos_cotacao")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("objetos_cotacao")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerObjeto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("objetos_cotacao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
