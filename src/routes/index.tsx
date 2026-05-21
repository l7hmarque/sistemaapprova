import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SynSIT — Gestão financeira e prestação de contas para OSCs" },
      { name: "description", content: "Plataforma para organizações da sociedade civil e escritórios contábeis do terceiro setor. Centralize lançamentos, prestação de contas e exportação SIT. Demonstração gratuita de 30 dias." },
      { property: "og:title", content: "SynSIT — Gestão para o terceiro setor" },
      { property: "og:description", content: "Centralize prestação de contas, lançamentos e relatórios. 30 dias grátis." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://synsit.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://synsit.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "3RD TECH",
        url: "https://synsit.lovable.app",
        brand: { "@type": "Brand", name: "SynSIT" },
        address: { "@type": "PostalAddress", addressLocality: "Medianeira", addressRegion: "PR", addressCountry: "BR" },
      }),
    }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <MarketingLayout>
      <section className="relative bg-brand-cream overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
            Plataforma SynSIT · por 3RD TECH
          </p>
          <h1 className="mt-4 text-5xl md:text-7xl font-serif text-brand-navy max-w-4xl leading-[1.05]">
            Gestão financeira sem fricção <em className="not-italic text-brand-blue">para o terceiro setor</em>.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-brand-muted max-w-2xl leading-relaxed">
            Da entrada do documento à prestação de contas mensal — em um único fluxo,
            pensado para organizações da sociedade civil e escritórios contábeis que
            atendem OSCs.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/demonstracao"
              className="rounded-md bg-brand-navy text-white px-6 py-3 text-base font-medium hover:bg-brand-navy-soft transition-colors"
            >
              Começar 30 dias grátis
            </Link>
            <a
              href="#planos"
              className="rounded-md border border-brand-navy text-brand-navy px-6 py-3 text-base font-medium hover:bg-white transition-colors"
            >
              Ver planos
            </a>
          </div>
          <p className="mt-6 text-sm text-brand-muted">
            Sem cartão de crédito · Sem fidelidade · Suporte humano em português
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 grid gap-6 md:grid-cols-2">
        <Link
          to="/contadores"
          className="group rounded-2xl border border-brand-line p-10 hover:border-brand-navy transition-colors"
        >
          <div className="text-xs uppercase tracking-widest text-brand-blue font-medium">Para escritórios contábeis</div>
          <h2 className="mt-3 text-3xl font-serif text-brand-navy">Contadores que atendem OSCs</h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            Padronize prestações de contas de várias entidades. Reduza retrabalho com
            modelos prontos para os principais editais e termos.
          </p>
          <div className="mt-6 text-brand-blue font-medium group-hover:underline underline-offset-4">
            Ver vantagens para contadores →
          </div>
        </Link>
        <Link
          to="/gestores"
          className="group rounded-2xl border border-brand-line p-10 hover:border-brand-navy transition-colors"
        >
          <div className="text-xs uppercase tracking-widest text-brand-blue font-medium">Para a sua OSC</div>
          <h2 className="mt-3 text-3xl font-serif text-brand-navy">Gestores e equipes financeiras de OSCs</h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            Menos tempo com papelada, mais tempo com a causa. Acompanhe orçamento,
            cumprimento de metas e prazos sem planilhas paralelas.
          </p>
          <div className="mt-6 text-brand-blue font-medium group-hover:underline underline-offset-4">
            Ver vantagens para gestores →
          </div>
        </Link>
      </section>

      <PlanCards />

      <FaqAccordion items={[
        { q: "A demonstração é mesmo gratuita?", a: "Sim. 30 dias completos, com acesso a todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito e você pode encerrar quando quiser." },
        { q: "Preciso instalar algo?", a: "Não. SynSIT é 100% web. Funciona em qualquer navegador moderno, no computador ou no celular." },
        { q: "Meus dados ficam seguros?", a: "Sim. Toda a infraestrutura é criptografada, com backups diários. Acesso por usuário com autenticação individual." },
        { q: "Atende a quais editais e legislações?", a: "Atendemos os principais formatos exigidos por órgãos de controle do terceiro setor no Brasil, incluindo exportações no padrão SIT/TCE-PR. Outros formatos podem ser adicionados conforme necessidade." },
        { q: "Posso trocar de plano depois?", a: "Sim. Você pode aumentar ou reduzir o plano a qualquer momento, sem multa." },
      ]} />
    </MarketingLayout>
  );
}
