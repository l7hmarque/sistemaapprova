import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function gerarToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CriarConviteSchema = z.object({
  cotacao_id: z.string().uuid(),
  fornecedor_id: z.string().uuid().nullish(),
  razao_social: z.string().min(1).max(255),
  cnpj: z.string().min(1).max(40),
  email: z.string().email().max(255).nullish().or(z.literal("")),
  telefone: z.string().max(40).nullish(),
  representante_legal: z.string().max(255).nullish(),
  cpf_representante: z.string().max(40).nullish(),
  endereco: z.string().max(500).nullish(),
  validade_dias: z.number().min(1).max(180).default(30),
});

export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarConviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const token = gerarToken();
    const expira = new Date(Date.now() + data.validade_dias * 86400_000).toISOString();
    const { data: orgId } = await context.supabase.rpc("current_user_org");
    if (!orgId) throw new Error("Organização ativa não encontrada.");
    const { data: row, error } = await context.supabase
      .from("convites_cotacao")
      .insert({
        organization_id: orgId as string,
        cotacao_id: data.cotacao_id,
        fornecedor_id: data.fornecedor_id || null,
        razao_social: data.razao_social,
        cnpj: data.cnpj,
        email: data.email || null,
        telefone: data.telefone || null,
        representante_legal: data.representante_legal || null,
        cpf_representante: data.cpf_representante || null,
        endereco: data.endereco || null,
        token,
        expira_em: expira,
        status: "pendente",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listarConvitesDaCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cotacao_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("convites_cotacao")
      .select("*")
      .eq("cotacao_id", data.cotacao_id)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const removerConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("convites_cotacao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
