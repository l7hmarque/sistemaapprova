/**
 * Cron: envia lembretes para convites de cotação pendentes cuja expiração
 * é em ≤ 3 dias, e marca como "expirado" os que já passaram.
 * Autenticação: cabeçalho `apikey` = SUPABASE anon key.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend } from "@/lib/email.server";

const ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const APP_ORIGIN = process.env.APP_ORIGIN || "https://sistemaapprova.lovable.app";

function esc(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string),
  );
}

async function processar() {
  // 1) marca expirados
  await supabaseAdmin
    .from("convites_cotacao")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lt("expira_em", new Date().toISOString());

  // 2) busca pendentes que expiram em ≤ 3 dias, ainda não lembrados nas últimas 48h
  const em3dias = new Date(Date.now() + 3 * 86400_000).toISOString();
  const ha48h = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: convites } = await supabaseAdmin
    .from("convites_cotacao")
    .select("id, email, razao_social, token, expira_em, cotacao_id, envios_count, ultimo_envio_em")
    .eq("status", "pendente")
    .lte("expira_em", em3dias)
    .lt("ultimo_envio_em", ha48h)
    .not("email", "is", null)
    .limit(200);

  let enviados = 0;
  for (const c of convites ?? []) {
    const { data: cot } = await supabaseAdmin
      .from("cotacoes")
      .select("objeto, termo")
      .eq("id", c.cotacao_id)
      .single();
    if (!cot) continue;
    const link = `${APP_ORIGIN}/cotacao/${c.token}`;
    const dataExp = new Date(c.expira_em).toLocaleDateString("pt-BR");
    try {
      await sendEmailViaResend({
        to: c.email!,
        subject: `Lembrete: orçamento pendente — ${cot.objeto}`,
        html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:8px;padding:24px;">
  <div style="font-size:12px;letter-spacing:2px;color:#888;">APPROVA · LEMBRETE</div>
  <h1 style="font-size:18px;margin:6px 0 12px;">Faltam poucos dias para responder</h1>
  <p>Olá, ${esc(c.razao_social)}. Sua cotação de <strong>${esc(cot.objeto)}</strong>${cot.termo ? ` (${esc(cot.termo)})` : ""} expira em <strong>${dataExp}</strong>.</p>
  <div style="margin:20px 0;text-align:center;">
    <a href="${link}" style="background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;display:inline-block;">Preencher agora</a>
  </div>
  <p style="color:#888;font-size:12px;">Ou copie: <a href="${link}" style="color:#0f172a;">${link}</a></p>
</div></body></html>`,
      });
      await supabaseAdmin
        .from("convites_cotacao")
        .update({
          ultimo_envio_em: new Date().toISOString(),
          envios_count: (c.envios_count ?? 1) + 1,
        })
        .eq("id", c.id);
      enviados++;
    } catch (e) {
      console.error("[cotacao-lembretes] falha convite", c.id, e);
    }
  }
  return { enviados, verificados: (convites ?? []).length };
}

export const Route = createFileRoute("/api/public/hooks/cotacao-lembretes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!ANON) return new Response("SUPABASE_PUBLISHABLE_KEY ausente", { status: 500 });
        if (request.headers.get("apikey") !== ANON) return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json(await processar());
        } catch (e) {
          console.error("[cotacao-lembretes] falha:", e);
          return new Response((e as Error).message, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        if (!ANON) return new Response("SUPABASE_PUBLISHABLE_KEY ausente", { status: 500 });
        if (request.headers.get("apikey") !== ANON) return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json(await processar());
        } catch (e) {
          console.error("[cotacao-lembretes] falha:", e);
          return new Response((e as Error).message, { status: 500 });
        }
      },
    },
  },
});
