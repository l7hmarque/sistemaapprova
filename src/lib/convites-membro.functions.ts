import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function gerarToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const RoleSchema = z.enum(["owner", "admin", "membro"]);

const CriarConviteMembroSchema = z.object({
  organization_id: z.string().uuid(),
  email: z.string().email().max(255),
  role: RoleSchema.default("membro"),
  validade_dias: z.number().min(1).max(60).default(14),
});

export const criarConviteMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarConviteMembroSchema.parse(d))
  .handler(async ({ data, context }) => {
    const token = gerarToken();
    const expira = new Date(Date.now() + data.validade_dias * 86400_000).toISOString();
    const { data: row, error } = await context.supabase
      .from("convites_membro")
      .insert({
        organization_id: data.organization_id,
        email: data.email.toLowerCase(),
        role: data.role,
        token,
        expira_em: expira,
        convidado_por: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listarConvitesMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organization_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("convites_membro")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const removerConviteMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("convites_membro")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Aceitar convite: o usuário precisa estar logado.
 * Usa supabaseAdmin para gravar o membership (RLS de organization_members exige owner/admin para INSERT).
 */
export const aceitarConviteMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const userEmail = (context.claims?.email as string | undefined)?.toLowerCase() ?? null;

    const { data: convite, error: errC } = await supabaseAdmin
      .from("convites_membro")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (errC) throw new Error(errC.message);
    if (!convite) throw new Error("Convite inválido");
    if (convite.aceito_em) throw new Error("Convite já utilizado");
    if (new Date(convite.expira_em) < new Date()) throw new Error("Convite expirado");
    if (userEmail && convite.email && userEmail !== convite.email.toLowerCase()) {
      throw new Error("Este convite foi enviado para outro e-mail");
    }

    // Já é membro?
    const { data: jaMembro } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", convite.organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!jaMembro) {
      const { error: errIns } = await supabaseAdmin
        .from("organization_members")
        .insert({
          organization_id: convite.organization_id,
          user_id: userId,
          role: convite.role as "owner" | "admin" | "membro",
        });
      if (errIns) throw new Error(errIns.message);
    }

    await supabaseAdmin
      .from("convites_membro")
      .update({ aceito_em: new Date().toISOString(), aceito_por: userId })
      .eq("id", convite.id);

    return { ok: true, organization_id: convite.organization_id };
  });
