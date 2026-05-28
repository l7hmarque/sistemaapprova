import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { registrarEvento } from "@/lib/analytics.functions";

const SID_KEY = "synsit_sid";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE = "synsit_utm";

function getOrCreateSid(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "").slice(0, 24);
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

function getUtm() {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  try {
    const url = new URL(window.location.href);
    let captured = false;
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k);
      if (v) { out[k] = v; captured = true; }
    }
    if (captured) sessionStorage.setItem(UTM_STORAGE, JSON.stringify(out));
    else {
      const stored = sessionStorage.getItem(UTM_STORAGE);
      if (stored) return JSON.parse(stored);
    }
  } catch {}
  return out;
}

function isInternalTraffic(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const host = window.location.hostname;
    // Preview do editor Lovable e sandbox
    if (host.endsWith("lovableproject.com")) return true;
    if (host.endsWith("lovable.dev")) return true;
    if (host.includes("id-preview--")) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;

    // Referrer vindo do editor
    const ref = document.referrer || "";
    if (ref) {
      try {
        const r = new URL(ref).hostname;
        if (r.endsWith("lovable.dev")) return true;
        if (r.endsWith("lovableproject.com")) return true;
        if (r.includes("id-preview--")) return true;
      } catch {}
    }

    // Marca persistente: usuário logado já flagado como interno
    if (localStorage.getItem("synsit_interno") === "1") return true;

    // Query param de bypass do editor
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("lovable_preview") || sp.has("__lovable")) return true;
  } catch {}
  return false;
}

async function send(evento: string, rota: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (rota.startsWith("/admin") || rota.startsWith("/login") || rota.startsWith("/owner")) return;
  if (isInternalTraffic()) return;
  try {
    await registrarEvento({
      data: {
        session_id: getOrCreateSid(),
        rota,
        evento: evento as "page_view",
        payload,
        referrer: document.referrer || null,
        ...getUtm(),
      },
    });
  } catch {
    /* swallow — analytics nunca quebra UX */
  }
}


export function useAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastRoute = useRef<string | null>(null);
  const mountedAt = useRef<number>(Date.now());
  const scrollHit = useRef<Set<number>>(new Set());

  // page_view a cada navegação
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastRoute.current === pathname) return;
    // envia time_on_page da rota anterior
    if (lastRoute.current) {
      const seconds = Math.round((Date.now() - mountedAt.current) / 1000);
      if (seconds > 1 && seconds < 3600) {
        send("time_on_page", lastRoute.current, { seconds });
      }
    }
    mountedAt.current = Date.now();
    scrollHit.current = new Set();
    lastRoute.current = pathname;
    send("page_view", pathname);
  }, [pathname]);

  // scroll_depth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const h = document.documentElement;
      const scrolled = (h.scrollTop + window.innerHeight) / h.scrollHeight;
      const pct = Math.min(100, Math.round(scrolled * 100));
      for (const limite of [25, 50, 75, 100]) {
        if (pct >= limite && !scrollHit.current.has(limite)) {
          scrollHit.current.add(limite);
          send("scroll_depth", pathname, { pct: limite });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // cta_click via [data-track-cta]
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.("[data-track-cta]") as HTMLElement | null;
      if (!el) return;
      const cta = el.getAttribute("data-track-cta") ?? "unknown";
      send("cta_click", pathname, { cta });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  // form_start em campos de formulário (focus em input/textarea)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let fired = false;
    const onFocus = (e: FocusEvent) => {
      if (fired) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const isField = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
      if (!isField) return;
      if (!t.closest("form")) return;
      fired = true;
      send("form_start", pathname);
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [pathname]);
}

export function trackEvent(evento: "form_submit" | "cta_click", payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  send(evento, window.location.pathname, payload);
}
