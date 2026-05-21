import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import previewUpload from "@/assets/preview-upload.png";
import previewDashboard from "@/assets/preview-dashboard.png";
import previewRelatorio from "@/assets/preview-relatorio.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SynSIT — Gestão financeira e prestação de contas para OSCs" },
      { name: "description", content: "Plataforma para organizações da sociedade civil e escritórios contábeis do terceiro setor. Centralize lançamentos, prestação de contas e exportação SIT. Demonstração gratuita de 30 dias." },
      { property: "og:title", content: "SynSIT — Gestão para o terceiro setor" },
      { property: "og:description", content: "Centralize prestação de contas, lançamentos e relatórios. 30 dias grátis." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://synsit.lovable.app/" },
      { property: "og:image", content: "https://synsit.lovable.app" + previewDashboard },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://synsit.lovable.app" + previewDashboard },
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
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
              Plataforma SynSIT · por 3RD TECH
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-serif text-brand-navy leading-[1.05]">
              Gestão financeira sem fricção <em className="not-italic text-brand-blue">para o terceiro setor</em>.
            </h1>
            <p className="mt-6 text-lg text-brand-muted max-w-xl leading-relaxed">
              Da entrada do documento à prestação de contas mensal — em um único fluxo,
              pensado para organizações da sociedade civil e escritórios contábeis que
              atendem OSCs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/demonstracao"
                data-track-cta="hero-demo"
                className="rounded-md bg-brand-navy text-white px-6 py-3 text-base font-medium hover:bg-brand-navy-soft transition-colors"
              >
                Começar 30 dias grátis
              </Link>
              <a
                href="#planos"
                data-track-cta="hero-planos"
                className="rounded-md border border-brand-navy text-brand-navy px-6 py-3 text-base font-medium hover:bg-white transition-colors"
              >
                Ver planos
              </a>
            </div>
            <p className="mt-6 text-sm text-brand-muted">
              Sem cartão de crédito · Sem fidelidade · Suporte humano em português
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-brand-blue/5 rounded-3xl blur-2xl" aria-hidden="true" />
            <div className="relative rounded-xl overflow-hidden border border-brand-line shadow-2xl bg-white">
              <img
                src={previewDashboard}
                alt="Painel da entidade no SynSIT mostrando execução de R$ 312.450 no exercício, 4 projetos ativos, execução por projeto e próximos prazos de prestação de contas."
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-brand-line">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Como funciona</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
              Do recibo até a prestação de contas — sem planilhas paralelas.
            </h2>
            <p className="mt-4 text-brand-muted leading-relaxed">
              Três etapas, um único histórico auditável por projeto, rubrica e termo.
            </p>
          </div>

          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            <li>
              <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
                <img
                  src={previewUpload}
                  alt="Tela de lançamentos do SynSIT com recibos e NF-e categorizados por projeto (Educa+ Comunidade, Saúde na Periferia, Mães Acolhidas) e rubrica."
                  loading="lazy"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-brand-blue font-serif text-2xl">01</span>
                <h3 className="text-xl font-serif text-brand-navy">Lance e categorize</h3>
              </div>
              <p className="mt-2 text-brand-muted leading-relaxed">
                Cada despesa é amarrada a um projeto, rubrica e termo de fomento.
                Sem campos soltos, sem retrabalho no fechamento.
              </p>
            </li>
            <li>
              <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
                <img
                  src={previewDashboard}
                  alt="Painel da OSC com KPIs de execução orçamentária, saldo disponível, projetos ativos e próximos prazos."
                  loading="lazy"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-brand-blue font-serif text-2xl">02</span>
                <h3 className="text-xl font-serif text-brand-navy">Acompanhe execução e prazos</h3>
              </div>
              <p className="mt-2 text-brand-muted leading-relaxed">
                Veja em tempo real o quanto cada projeto já executou, o saldo
                disponível e o que precisa ser entregue nas próximas semanas.
              </p>
            </li>
            <li>
              <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
                <img
                  src={previewRelatorio}
                  alt="Relatório de prestação de contas do termo de fomento 042/2025 com despesas por rubrica e exportação SIT/TCE-PR."
                  loading="lazy"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-brand-blue font-serif text-2xl">03</span>
                <h3 className="text-xl font-serif text-brand-navy">Preste contas com lastro</h3>
              </div>
              <p className="mt-2 text-brand-muted leading-relaxed">
                Relatório consolidado por termo, com comprovação documental anexa
                e exportação direta no padrão SIT/TCE-PR.
              </p>
            </li>
          </ol>
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
