import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmailViaResend } from "./email.server";

function gerarToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function appOrigin(): string {
  return process.env.APP_ORIGIN || "https://sistemaapprova.lovable.app";
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string),
  );
}

function buildConviteEmail(args: {
  objeto: string;
  termo: string | null;
  itens: Array<{ descricao: string; qtd: number; unidade: string }>;
  link: string;
  expiraEm: string;
  razaoSocial: string;
}) {
  const listaItens = args.itens
    .slice(0, 20)
    .map(
      (it, i) =>
        `<tr><td style="padding:4px 8px;color:#555;">${i + 1}</td><td style="padding:4px 8px;">${esc(it.descricao)}</td><td style="padding:4px 8px;text-align:right;color:#555;">${it.qtd} ${esc(it.unidade)}</td></tr>`,
    )
    .join("");
  const maisItens = args.itens.length > 20 ? `<p style="color:#888;font-size:12px;margin:8px 0 0;">+ ${args.itens.length - 20} itens adicionais</p>` : "";
  const dataExp = new Date(args.expiraEm).toLocaleDateString("pt-BR");
  return {
    subject: `Solicitação de orçamento — ${args.objeto}`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:20px 24px;border-bottom:1px solid #eee;">
    <div style="font-size:12px;letter-spacing:2px;color:#888;">APPROVA · SOLICITAÇÃO DE ORÇAMENTO</div>
    <h1 style="font-size:20px;margin:6px 0 0;">${esc(args.objeto)}</h1>
    ${args.termo ? `<p style="color:#666;margin:4px 0 0;font-size:13px;">Termo: ${esc(args.termo)}</p>` : ""}
  </td></tr>
  <tr><td style="padding:20px 24px;">
    <p style="margin:0 0 12px;">Olá, ${esc(args.razaoSocial)},</p>
    <p style="margin:0 0 12px;">Convidamos sua empresa a apresentar preços para os itens abaixo. Após preencher, você receberá o PDF para imprimir, assinar e carimbar.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;border-top:1px solid #eee;">
      ${listaItens}
    </table>
    ${maisItens}
    <div style="margin:24px 0;text-align:center;">
      <a href="${args.link}" style="background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;display:inline-block;">Preencher orçamento</a>
    </div>
    <p style="color:#888;font-size:12px;margin:0;">Ou copie este endereço no navegador:<br><a href="${args.link}" style="color:#0f172a;">${args.link}</a></p>
    <p style="color:#888;font-size:12px;margin:12px 0 0;">Este link expira em ${dataExp}.</p>
  </td></tr>
</table>
</body></html>`,
  };
}

async function dispararEmailConvite(supabase: any, conviteId: string): Promise<{ enviado: boolean; motivo?: string }> {
  const { data: c } = await supabase.from("convites_cotacao").select("*").eq("id", conviteId).single();
  if (!c) return { enviado: false, motivo: "convite não encontrado" };
  if (!c.email) return { enviado: false, motivo: "sem e-mail" };
  const { data: cot } = await supabase
    .from("cotacoes")
    .select("objeto, termo, itens")
    .eq("id", c.cotacao_id)
    .single();
  if (!cot) return { enviado: false, motivo: "cotação não encontrada" };
  const link = `${appOrigin()}/cotacao/${c.token}`;
  const { subject, html } = buildConviteEmail({
    objeto: cot.objeto,
    termo: cot.termo,
    itens: (cot.itens as any[]) ?? [],
    link,
    expiraEm: c.expira_em,
    razaoSocial: c.razao_social,
  });
  await sendEmailViaResend({ to: c.email, subject, html });
  return { enviado: true };
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

    let emailStatus: { enviado: boolean; motivo?: string } = { enviado: false, motivo: "sem e-mail" };
    if (row.email) {
      try {
        emailStatus = await dispararEmailConvite(context.supabase, row.id);
      } catch (e) {
        console.error("[convite] envio falhou:", e);
        emailStatus = { enviado: false, motivo: (e as Error).message };
      }
    }
    return { ...row, email_enviado: emailStatus.enviado, email_motivo: emailStatus.motivo ?? null };
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

export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await dispararEmailConvite(context.supabase, data.id);
    if (!r.enviado) throw new Error(r.motivo || "Sem e-mail para reenviar");
    const { error } = await context.supabase
      .from("convites_cotacao")
      .update({
        ultimo_envio_em: new Date().toISOString(),
        envios_count: (
          (await context.supabase.from("convites_cotacao").select("envios_count").eq("id", data.id).single())
            .data?.envios_count ?? 1
        ) + 1,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const atualizarStatusConvitesExpirados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: orgId } = await context.supabase.rpc("current_user_org");
    if (!orgId) throw new Error("Organização ativa não encontrada.");
    const { data, error } = await context.supabase
      .from("convites_cotacao")
      .update({ status: "expirado" })
      .eq("organization_id", orgId as string)
      .eq("status", "pendente")
      .lt("expira_em", new Date().toISOString())
      .select("id");
    if (error) throw new Error(error.message);
    return { atualizados: data?.length ?? 0 };
  });
