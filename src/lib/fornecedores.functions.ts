import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validarCNPJ, validarCPF } from "@/lib/sit/validarDoc";

const FornecedorSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  razao_social: z.string().min(1).max(255),
  cnpj: z.string().min(1).max(40).refine((v) => validarCNPJ(v) || validarCPF(v), {
    message: "CNPJ/CPF inválido (dígitos verificadores)",
  }),
  representante_legal: z.string().max(255).nullish(),
  cpf_representante: z
    .string()
    .max(40)
    .nullish()
    .refine((v) => !v || validarCPF(v), { message: "CPF do representante inválido" }),
  email: z.string().email().max(255).nullish().or(z.literal("")),
  telefone: z.string().max(40).nullish(),
  endereco: z.string().max(500).nullish(),
});

export const listarFornecedores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organization_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("fornecedores").select("*").order("razao_social", { ascending: true });
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const salvarFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FornecedorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      razao_social: data.razao_social,
      cnpj: data.cnpj,
      representante_legal: data.representante_legal || null,
      cpf_representante: data.cpf_representante || null,
      email: data.email || null,
      telefone: data.telefone || null,
      endereco: data.endereco || null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("fornecedores")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const insertPayload = data.organization_id
      ? { ...payload, organization_id: data.organization_id }
      : payload;
    const { data: row, error } = await context.supabase
      .from("fornecedores")
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fornecedores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const buscarPorCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ cnpj: z.string().min(1).max(40), organization_id: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const limpo = data.cnpj.replace(/\D/g, "");
    let q = context.supabase
      .from("fornecedores")
      .select("*")
      .or(`cnpj.eq.${data.cnpj},cnpj.eq.${limpo}`)
      .limit(1);
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows } = await q;
    return rows?.[0] ?? null;
  });
