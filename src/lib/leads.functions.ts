import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Captura de leads das landing pages. Pública (sem auth).
 * - Valida input
 * - Rate limit por IP (5/hora)
 * - Salva no banco
 * - Tenta notificar a equipe (best-effort, nunca trava o lead)
 */

const LeadSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  telefone: z.string().trim().min(8).max(40),
  cargo: z.string().trim().min(2).max(120),
  osc_nome: z.string().trim().min(2).max(200),
  plano: z.enum(["essencial", "profissional", "escritorio"]),
  publico: z.enum(["contador", "gestor", "outro"]).optional(),

  qtd_oscs: z.number().int().min(0).max(9999).optional().nullable(),
  qtd_lancamentos: z.number().int().min(0).max(100000).optional().nullable(),
  dor: z.string().trim().max(800).optional().nullable(),
  origem_descoberta: z.string().trim().max(80).optional().nullable(),

  utm_source: z.string().trim().max(120).optional().nullable(),
  utm_medium: z.string().trim().max(120).optional().nullable(),
  utm_campaign: z.string().trim().max(120).optional().nullable(),
  utm_term: z.string().trim().max(120).optional().nullable(),
  utm_content: z.string().trim().max(120).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  page_path: z.string().trim().max(200).optional().nullable(),

  hp: z.string().max(0).optional(), // honeypot
});

async function hashIp(ip: string): Promise<string> {
  const enc = new TextEncoder().encode("synsit::" + ip);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkRateLimit(ipHash: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("leads_rate_limit")
    .select("count, window_start")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (!data) {
    await supabaseAdmin.from("leads_rate_limit").insert({ ip_hash: ipHash, count: 1 });
    return true;
  }
  if (data.window_start < oneHourAgo) {
    await supabaseAdmin
      .from("leads_rate_limit")
      .update({ count: 1, window_start: new Date().toISOString() })
      .eq("ip_hash", ipHash);
    return true;
  }
  if (data.count >= 5) return false;
  await supabaseAdmin
    .from("leads_rate_limit")
    .update({ count: data.count + 1 })
    .eq("ip_hash", ipHash);
  return true;
}

export const enviarLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LeadSchema.parse(d))
  .handler(async ({ data }) => {
    // honeypot — bots normalmente preenchem tudo
    if (data.hp && data.hp.length > 0) {
      return { ok: true }; // pretende sucesso
    }

    const req = getRequest();
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const ipHash = await hashIp(ip);
    const ua = req.headers.get("user-agent") ?? null;

    const allowed = await checkRateLimit(ipHash);
    if (!allowed) {
      throw new Error("Muitas solicitações deste endereço. Tente novamente em 1 hora.");
    }

    const insertPayload = {
      nome: data.nome,
      email: data.email.toLowerCase(),
      telefone: data.telefone,
      cargo: data.cargo,
      osc_nome: data.osc_nome,
      plano: data.plano,
      publico: data.publico ?? null,
      qtd_oscs: data.qtd_oscs ?? null,
      qtd_lancamentos: data.qtd_lancamentos ?? null,
      dor: data.dor ?? null,
      origem_descoberta: data.origem_descoberta ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_term: data.utm_term ?? null,
      utm_content: data.utm_content ?? null,
      referrer: data.referrer ?? null,
      user_agent: ua,
      ip_hash: ipHash,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) {
      console.error("[lead] insert failed", error);
      throw new Error("Não foi possível registrar sua solicitação. Tente novamente.");
    }

    // Best-effort: notificar equipe. Falha silenciosa.
    try {
      await notificarEquipe({ ...insertPayload, id: inserted.id });
    } catch (e) {
      console.warn("[lead] notification failed (lead saved)", e);
    }

    return { ok: true, id: inserted.id };
  });

async function notificarEquipe(lead: Record<string, unknown> & { id: string }) {
  const DEST = "l7hmarque@gmail.com";
  const SUBJECT = `LEAD Approva — ${lead.nome} (${lead.plano})`;

  // Tenta via Lovable Emails infra se disponível (RPC enqueue_email).
  // Se não houver, registra no log e segue — admin verá lead no /admin/leads.
  try {
    const html = renderLeadEmail(lead);
    const text = renderLeadEmailText(lead);
    const { error } = await supabaseAdmin.rpc("enqueue_email" as never, {
      p_queue_name: "transactional_emails",
      p_payload: {
        to: DEST,
        from: { email: "no-reply@synsit.app", name: "Approva Leads" },
        subject: SUBJECT,
        html,
        text,
        template_name: "lead_notification",
        message_id: `lead-${lead.id}`,
      },
    } as never);
    if (error) throw error;
    console.log("[lead] notification enqueued", lead.id);
  } catch (e) {
    console.warn("[lead] email infra unavailable; lead is in DB at /admin/leads", e);
  }
}

function esc(v: unknown): string {
  return String(v ?? "—").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

function renderLeadEmail(l: Record<string, unknown>): string {
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f5f0e0;padding:24px;color:#0f1b3d">
  <div style="max-width:560px;margin:auto;background:#fff;padding:32px;border-radius:12px">
    <h1 style="font-family:'Instrument Serif',serif;margin:0 0 4px;color:#0f1b3d">Novo lead Approva</h1>
    <p style="color:#5b6478;margin:0 0 24px">Capturado pela landing page.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#5b6478">Nome</td><td style="padding:6px 0"><b>${esc(l.nome)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#5b6478">Email</td><td style="padding:6px 0"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></td></tr>
      <tr><td style="padding:6px 0;color:#5b6478">Telefone</td><td style="padding:6px 0">${esc(l.telefone)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6478">Cargo</td><td style="padding:6px 0">${esc(l.cargo)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6478">OSC / Escritório</td><td style="padding:6px 0">${esc(l.osc_nome)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6478">Plano de interesse</td><td style="padding:6px 0"><b>${esc(l.plano)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#5b6478">Público</td><td style="padding:6px 0">${esc(l.publico)}</td></tr>
      ${l.qtd_oscs ? `<tr><td style="padding:6px 0;color:#5b6478">Qtd. OSCs</td><td style="padding:6px 0">${esc(l.qtd_oscs)}</td></tr>` : ""}
      ${l.qtd_lancamentos ? `<tr><td style="padding:6px 0;color:#5b6478">Lançamentos/mês</td><td style="padding:6px 0">${esc(l.qtd_lancamentos)}</td></tr>` : ""}
      ${l.dor ? `<tr><td style="padding:6px 0;color:#5b6478;vertical-align:top">Dor relatada</td><td style="padding:6px 0">${esc(l.dor)}</td></tr>` : ""}
      ${l.origem_descoberta ? `<tr><td style="padding:6px 0;color:#5b6478">Como conheceu</td><td style="padding:6px 0">${esc(l.origem_descoberta)}</td></tr>` : ""}
    </table>
    <hr style="margin:24px 0;border:0;border-top:1px solid #e6e1d3">
    <p style="margin:0 0 6px;color:#5b6478;font-size:12px"><b>Atribuição</b></p>
    <p style="margin:0;color:#5b6478;font-size:12px">
      ${esc(l.utm_source)} / ${esc(l.utm_medium)} / ${esc(l.utm_campaign)}<br>
      Referrer: ${esc(l.referrer)}
    </p>
  </div></body></html>`;
}

function renderLeadEmailText(l: Record<string, unknown>): string {
  return [
    "Novo lead Approva",
    "",
    `Nome: ${l.nome}`,
    `Email: ${l.email}`,
    `Telefone: ${l.telefone}`,
    `Cargo: ${l.cargo}`,
    `OSC/Escritório: ${l.osc_nome}`,
    `Plano: ${l.plano}`,
    `Público: ${l.publico}`,
    l.qtd_oscs ? `Qtd OSCs: ${l.qtd_oscs}` : null,
    l.qtd_lancamentos ? `Lançamentos/mês: ${l.qtd_lancamentos}` : null,
    l.dor ? `Dor: ${l.dor}` : null,
    `UTM: ${l.utm_source}/${l.utm_medium}/${l.utm_campaign}`,
    `Referrer: ${l.referrer}`,
  ].filter(Boolean).join("\n");
}
