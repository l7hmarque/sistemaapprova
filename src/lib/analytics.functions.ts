import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EventoSchema = z.object({
  session_id: z.string().min(8).max(64),
  rota: z.string().min(1).max(255),
  evento: z.enum([
    "page_view",
    "cta_click",
    "scroll_depth",
    "form_start",
    "form_submit",
    "time_on_page",
  ]),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  referrer: z.string().max(500).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  utm_term: z.string().max(120).optional().nullable(),
  utm_content: z.string().max(120).optional().nullable(),
});

const BOT_RE = /bot|crawler|spider|crawling|preview|monitor|lighthouse|headless/i;

export const registrarEvento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EventoSchema.parse(input))
  .handler(async ({ data }) => {
    const ua = getRequestHeader("user-agent") ?? "";
    if (BOT_RE.test(ua)) return { ok: true, skipped: "bot" as const };

    const country =
      getRequestHeader("cf-ipcountry") ??
      getRequestHeader("x-vercel-ip-country") ??
      null;

    const { error } = await supabaseAdmin.from("eventos_visita").insert({
      session_id: data.session_id,
      rota: data.rota,
      evento: data.evento,
      payload: (data.payload ?? {}) as never,
      referrer: data.referrer ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_term: data.utm_term ?? null,
      utm_content: data.utm_content ?? null,
      user_agent: ua.slice(0, 255),
      country,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const obterAnalytics = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ dias: z.number().int().min(1).max(90).optional().default(30) })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const desde = new Date(Date.now() - data.dias * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("eventos_visita")
      .select("rota,evento,referrer,utm_source,utm_medium,utm_campaign,session_id,country,created_at,payload")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) return { ok: false as const, error: error.message };

    type Row = NonNullable<typeof rows>[number];
    const list: Row[] = rows ?? [];

    const porDia = new Map<string, number>();
    const porRota = new Map<string, number>();
    const porReferrer = new Map<string, number>();
    const porUtmSource = new Map<string, number>();
    const sessoesPorRota = new Map<string, Set<string>>();
    const ctas = new Map<string, number>();
    const funilPorRota = new Map<
      string,
      { views: Set<string>; scroll50: Set<string>; cta: Set<string>; formStart: Set<string>; formSubmit: Set<string> }
    >();

    const get = (m: Map<string, ReturnType<typeof funilPorRota.get>>, k: string) => {
      let v = funilPorRota.get(k);
      if (!v) {
        v = { views: new Set(), scroll50: new Set(), cta: new Set(), formStart: new Set(), formSubmit: new Set() };
        funilPorRota.set(k, v);
      }
      return v;
    };

    for (const r of list) {
      const dia = (r.created_at as string).slice(0, 10);
      const rota = r.rota as string;
      const sid = r.session_id as string;

      if (r.evento === "page_view") {
        porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
        porRota.set(rota, (porRota.get(rota) ?? 0) + 1);
        if (r.referrer) {
          const host = (() => {
            try { return new URL(r.referrer as string).hostname; } catch { return "direto"; }
          })();
          porReferrer.set(host, (porReferrer.get(host) ?? 0) + 1);
        } else {
          porReferrer.set("direto", (porReferrer.get("direto") ?? 0) + 1);
        }
        if (r.utm_source) porUtmSource.set(r.utm_source, (porUtmSource.get(r.utm_source) ?? 0) + 1);

        let s = sessoesPorRota.get(rota);
        if (!s) { s = new Set(); sessoesPorRota.set(rota, s); }
        s.add(sid);

        get(funilPorRota, rota).views.add(sid);
      } else if (r.evento === "scroll_depth") {
        const pct = (r.payload as { pct?: number } | null)?.pct ?? 0;
        if (pct >= 50) get(funilPorRota, rota).scroll50.add(sid);
      } else if (r.evento === "cta_click") {
        const cta = (r.payload as { cta?: string } | null)?.cta ?? "desconhecido";
        ctas.set(cta, (ctas.get(cta) ?? 0) + 1);
        get(funilPorRota, rota).cta.add(sid);
      } else if (r.evento === "form_start") {
        get(funilPorRota, rota).formStart.add(sid);
      } else if (r.evento === "form_submit") {
        get(funilPorRota, rota).formSubmit.add(sid);
      }
    }

    return {
      ok: true as const,
      total: list.length,
      visitasPorDia: [...porDia.entries()].map(([dia, n]) => ({ dia, n })).sort((a, b) => a.dia.localeCompare(b.dia)),
      visitasPorRota: [...porRota.entries()].map(([rota, n]) => ({ rota, n })).sort((a, b) => b.n - a.n),
      referrers: [...porReferrer.entries()].map(([fonte, n]) => ({ fonte, n })).sort((a, b) => b.n - a.n).slice(0, 20),
      utmSources: [...porUtmSource.entries()].map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n),
      ctasTop: [...ctas.entries()].map(([cta, n]) => ({ cta, n })).sort((a, b) => b.n - a.n),
      funil: [...funilPorRota.entries()].map(([rota, f]) => ({
        rota,
        views: f.views.size,
        scroll50: f.scroll50.size,
        cta: f.cta.size,
        formStart: f.formStart.size,
        formSubmit: f.formSubmit.size,
      })).sort((a, b) => b.views - a.views),
    };
  });
