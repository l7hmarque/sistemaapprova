import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/obrigado")({
  validateSearch: z.object({
    plano: z.enum(["essencial", "profissional", "escritorio"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Recebemos sua solicitação — Approva" },
      { name: "description", content: "Sua solicitação de demonstração foi recebida. Em até 1 dia útil entraremos em contato." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ObrigadoPage,
});

function ObrigadoPage() {
  const { plano } = Route.useSearch();

  useEffect(() => {
    // Eventos de conversão (disparados quando pixels estiverem configurados)
    type ConversionWindow = Window & {
      gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
      fbq?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
    };
    const w = window as ConversionWindow;
    try { w.gtag?.("event", "generate_lead", { plano }); } catch {}
    try { w.fbq?.("track", "Lead", { plano }); } catch {}
  }, [plano]);

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-cream flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden>
            <path d="M5 12.5l4 4 10-10" stroke="#0f1b3d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-6 text-4xl md:text-5xl font-serif text-brand-navy">
          Recebemos sua solicitação.
        </h1>
        <p className="mt-4 text-brand-muted text-lg leading-relaxed">
          Nossa equipe entra em contato em até <strong className="text-brand-navy">1 dia útil</strong> para
          combinar a demonstração e liberar seu ambiente de 30 dias.
        </p>
        <p className="mt-6 text-brand-muted text-sm">
          Enquanto isso, dá uma olhada nas{" "}
          <Link to="/contadores" className="text-brand-blue underline underline-offset-4">vantagens para escritórios</Link>{" "}
          ou nas{" "}
          <Link to="/gestores" className="text-brand-blue underline underline-offset-4">vantagens para gestores</Link>.
        </p>
        <Link
          to="/"
          className="mt-10 inline-block rounded-md border border-brand-navy text-brand-navy px-6 py-3 font-medium hover:bg-brand-cream transition-colors"
        >
          Voltar para a página inicial
        </Link>
      </section>
    </MarketingLayout>
  );
}
