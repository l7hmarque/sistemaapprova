import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { enviarLead } from "@/lib/leads.functions";

const SearchSchema = z.object({
  plano: z.enum(["essencial", "profissional", "escritorio"]).optional(),
  publico: z.enum(["contador", "gestor", "outro"]).optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
});

export const Route = createFileRoute("/demonstracao")({
  validateSearch: SearchSchema,
  head: () => ({
    meta: [
      { title: "Solicitar demonstração gratuita — SynSIT" },
      { name: "description", content: "Teste o SynSIT por 30 dias sem cartão de crédito. Preencha o formulário e nossa equipe entra em contato." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const enviar = useServerFn(enviarLead);

  const [plano, setPlano] = useState(search.plano ?? "profissional");
  const [publico, setPublico] = useState(search.publico ?? "gestor");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Persiste UTMs em sessionStorage caso o usuário navegue antes de enviar
  useEffect(() => {
    const utms = {
      utm_source: search.utm_source,
      utm_medium: search.utm_medium,
      utm_campaign: search.utm_campaign,
      utm_term: search.utm_term,
      utm_content: search.utm_content,
    };
    if (Object.values(utms).some(Boolean)) {
      try { sessionStorage.setItem("__attr", JSON.stringify(utms)); } catch {}
    }
  }, [search]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    let utms: Record<string, string | undefined> = {
      utm_source: search.utm_source,
      utm_medium: search.utm_medium,
      utm_campaign: search.utm_campaign,
      utm_term: search.utm_term,
      utm_content: search.utm_content,
    };
    try {
      const stored = sessionStorage.getItem("__attr");
      if (stored) utms = { ...JSON.parse(stored), ...Object.fromEntries(Object.entries(utms).filter(([, v]) => v)) };
    } catch {}

    try {
      await enviar({
        data: {
          nome: String(fd.get("nome") ?? ""),
          email: String(fd.get("email") ?? ""),
          telefone: String(fd.get("telefone") ?? ""),
          cargo: String(fd.get("cargo") ?? ""),
          osc_nome: String(fd.get("osc_nome") ?? ""),
          plano,
          publico,
          qtd_oscs: fd.get("qtd_oscs") ? Number(fd.get("qtd_oscs")) : null,
          qtd_lancamentos: fd.get("qtd_lancamentos") ? Number(fd.get("qtd_lancamentos")) : null,
          dor: (fd.get("dor") as string) || null,
          origem_descoberta: (fd.get("origem_descoberta") as string) || null,
          referrer: typeof document !== "undefined" ? document.referrer : null,
          page_path: typeof window !== "undefined" ? window.location.pathname : null,
          hp: String(fd.get("hp") ?? ""),
          ...utms,
        },
      });
      navigate({ to: "/obrigado", search: { plano } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
          Demonstração gratuita
        </p>
        <h1 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy">
          30 dias para conhecer o SynSIT por dentro.
        </h1>
        <p className="mt-4 text-brand-muted leading-relaxed">
          Sem cartão de crédito, sem fidelidade. Preencha os dados abaixo e nossa
          equipe entra em contato em até 1 dia útil para liberar seu ambiente.
        </p>

        <form onSubmit={onSubmit} className="mt-10 grid gap-5">
          <input type="text" name="hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Seu nome" name="nome" required minLength={2} />
            <Field label="Email profissional" name="email" type="email" required />
            <Field label="Telefone / WhatsApp" name="telefone" type="tel" required />
            <Field label="Seu cargo" name="cargo" required />
            <Field label="Nome da OSC ou escritório" name="osc_nome" required className="md:col-span-2" />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="text-sm text-brand-navy font-medium">Eu sou…</label>
              <select
                value={publico}
                onChange={(e) => setPublico(e.target.value as typeof publico)}
                className="mt-1.5 w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-brand-navy"
              >
                <option value="gestor">Gestor / equipe da OSC</option>
                <option value="contador">Contador / escritório contábil</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-brand-navy font-medium">Plano de interesse</label>
              <select
                value={plano}
                onChange={(e) => setPlano(e.target.value as typeof plano)}
                className="mt-1.5 w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-brand-navy"
              >
                <option value="essencial">Essencial — R$ 497/mês</option>
                <option value="profissional">Profissional — R$ 897/mês</option>
                <option value="escritorio">Escritório — R$ 1.497/mês</option>
              </select>
            </div>
          </div>

          <details className="rounded-md border border-brand-line bg-brand-cream-soft p-4">
            <summary className="cursor-pointer text-sm text-brand-navy font-medium">
              Quer adiantar detalhes? (opcional)
            </summary>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field label="Quantas OSCs você atende?" name="qtd_oscs" type="number" min={0} />
              <Field label="Lançamentos por mês (estimativa)" name="qtd_lancamentos" type="number" min={0} />
              <div className="md:col-span-2">
                <label className="text-sm text-brand-navy font-medium">O que mais te incomoda hoje?</label>
                <textarea name="dor" rows={3} className="mt-1.5 w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-brand-navy" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-brand-navy font-medium">Como conheceu o SynSIT?</label>
                <input name="origem_descoberta" className="mt-1.5 w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-brand-navy" />
              </div>
            </div>
          </details>

          {erro && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-navy text-white px-6 py-3 font-medium hover:bg-brand-navy-soft transition-colors disabled:opacity-60"
            data-track-cta="submit-demo"
          >
            {loading ? "Enviando…" : "Solicitar demonstração"}
          </button>
          <p className="text-xs text-brand-muted">
            Ao enviar, você concorda com nossa{" "}
            <a href="/privacidade" className="underline">Política de Privacidade</a>.
          </p>
        </form>
      </section>
    </MarketingLayout>
  );
}

function Field({
  label, name, type = "text", required, minLength, min, className,
}: {
  label: string; name: string; type?: string; required?: boolean;
  minLength?: number; min?: number; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm text-brand-navy font-medium">{label}{required && <span className="text-brand-blue"> *</span>}</label>
      <input
        type={type} name={name} required={required} minLength={minLength} min={min}
        className="mt-1.5 w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-brand-navy outline-none focus:border-brand-navy"
      />
    </div>
  );
}
