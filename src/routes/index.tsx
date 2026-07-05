import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import previewCaptura from "@/assets/screens/captura.webp";
import previewPrestacao from "@/assets/screens/prestacao.webp";
import previewPainel from "@/assets/screens/painel.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Approva — Prestação de contas de repasses públicos (TCE-PR)" },
      { name: "description", content: "Importe o PDF mensal dos seus repasses públicos, revise lançamentos com IA, anexe comprovantes e exporte direto no padrão SIT/TCE-PR. 30 dias grátis." },
      { property: "og:title", content: "Approva — Prestação de contas para OSCs" },
      { property: "og:description", content: "Revise lançamentos, anexe comprovantes e exporte no padrão SIT/TCE-PR. 30 dias grátis." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sistemaapprova.lovable.app/" },
      { property: "og:image", content: "https://sistemaapprova.lovable.app" + previewPrestacao },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://sistemaapprova.lovable.app" + previewPrestacao },
    ],
    links: [
      { rel: "canonical", href: "https://sistemaapprova.lovable.app/" },
      { rel: "preload", as: "image", href: previewPrestacao, fetchPriority: "high" } as any,
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "3RD TECH",
          url: "https://sistemaapprova.lovable.app",
          brand: { "@type": "Brand", name: "Approva" },
          address: { "@type": "PostalAddress", addressLocality: "Medianeira", addressRegion: "PR", addressCountry: "BR" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Approva",
          url: "https://sistemaapprova.lovable.app/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Approva",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://sistemaapprova.lovable.app/",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL", description: "30 dias grátis" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "A demonstração é mesmo gratuita?", acceptedAnswer: { "@type": "Answer", text: "Sim. 30 dias completos, com acesso a todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito e você pode encerrar quando quiser." } },
            { "@type": "Question", name: "Preciso instalar algo?", acceptedAnswer: { "@type": "Answer", text: "Não. Approva é 100% web. Funciona em qualquer navegador moderno, no computador ou no celular." } },
            { "@type": "Question", name: "Meus dados ficam seguros?", acceptedAnswer: { "@type": "Answer", text: "Sim. Toda a infraestrutura é criptografada, com backups diários. Acesso por usuário com autenticação individual e trilha de aprovação de despesas." } },
            { "@type": "Question", name: "Atende a quais editais e legislações?", acceptedAnswer: { "@type": "Answer", text: "Hoje exportamos no padrão SIT/TCE-PR, com CNPJs validados, encoding ANSI Win-1252 e catálogo de naturezas econômicas oficiais. Outros formatos podem ser adicionados conforme necessidade." } },
            { "@type": "Question", name: "Posso trocar de plano depois?", acceptedAnswer: { "@type": "Answer", text: "Sim. Você pode aumentar ou reduzir o plano a qualquer momento, sem multa." } },
          ],
        }),
      },
    ],
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
              Plataforma Approva · por 3RD TECH
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-serif text-brand-navy leading-[1.05]">
              Prestação de contas dos seus repasses públicos <em className="not-italic text-brand-blue">sem fricção</em>.
            </h1>
            <p className="mt-6 text-lg text-brand-muted max-w-xl leading-relaxed">
              Importe o PDF mensal, revise os lançamentos extraídos por IA, anexe
              comprovantes com aprovação em duas mãos e exporte direto no padrão
              SIT/TCE-PR — sem planilhas paralelas.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/demonstracao"
                data-track-cta="hero-demo"
                className="text-center rounded-md bg-brand-navy text-white px-6 py-3 text-base font-medium hover:bg-brand-navy-soft transition-colors"
              >
                Começar 30 dias grátis
              </Link>
              <a
                href="#planos"
                data-track-cta="hero-planos"
                className="text-center rounded-md border border-brand-navy text-brand-navy px-6 py-3 text-base font-medium hover:bg-white transition-colors"
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
                src={previewPrestacao}
                alt="Tela do Approva — Prestação do Convênio 042/2025: KPIs do mês, total R$ 38.420,00, 28 de 32 documentos com comprovante e tabela de lançamentos com status aprovado/pendente."
                width={1600}
                height={896}
                fetchPriority="high"
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
              Do PDF da prestação até o arquivo SIT — em três etapas.
            </h2>
            <p className="mt-4 text-brand-muted leading-relaxed">
              Um histórico auditável por termo, mês e categoria — com comprovação documental anexa.
            </p>
          </div>

          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            <li>
              <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
                <img
                  src={previewCaptura}
                  alt="Tela de Captura do Approva: área de upload de PDF e XMLs, com fila de leitura mostrando NF-e, boletos e holerites já reconhecidos pela IA."
                  loading="lazy"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-brand-blue font-serif text-2xl">01</span>
                <h3 className="text-xl font-serif text-brand-navy">Importe o PDF mensal</h3>
              </div>
              <p className="mt-2 text-brand-muted leading-relaxed">
                A IA lê NF-e, boletos, guias e holerites do seu PDF e devolve cada
                despesa já categorizada — pronta para revisão.
              </p>
            </li>
            <li>
              <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
                <img
                  src={previewPrestacao}
                  alt="Tabela de lançamentos da prestação com colunas de rubrica, valor, comprovante anexado e status de aprovação em duas mãos."
                  loading="lazy"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-brand-blue font-serif text-2xl">02</span>
                <h3 className="text-xl font-serif text-brand-navy">Revise, anexe e aprove</h3>
              </div>
              <p className="mt-2 text-brand-muted leading-relaxed">
                Anexe o comprovante a cada despesa e aprove em duas mãos. O painel
                mostra o que ainda falta documentar e o que está pendente de revisão.
              </p>
            </li>
            <li>
              <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
                <img
                  src={previewPainel}
                  alt="Painel financeiro do Approva mostrando saldo do termo, próximo repasse e execução por rubrica — pronto para exportar SIT/TCE-PR."
                  loading="lazy"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-brand-blue font-serif text-2xl">03</span>
                <h3 className="text-xl font-serif text-brand-navy">Exporte para o TCE-PR</h3>
              </div>
              <p className="mt-2 text-brand-muted leading-relaxed">
                Um clique gera o <code>Despesa.txt</code> no padrão SIT do TCE-PR, com
                CNPJs validados, categorias certas e encoding correto.
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
            Padronize a prestação mensal dos seus clientes do terceiro setor. Menos
            retrabalho, mais lastro auditável.
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
          <h2 className="mt-3 text-3xl font-serif text-brand-navy">Gestores e equipes financeiras</h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            Feche o mês do seu termo em horas, não em dias. Comprovante anexado,
            aprovação registrada e exportação pronta para o controle.
          </p>
          <div className="mt-6 text-brand-blue font-medium group-hover:underline underline-offset-4">
            Ver vantagens para gestores →
          </div>
        </Link>
      </section>

      <PlanCards />

      <FaqAccordion items={[
        { q: "A demonstração é mesmo gratuita?", a: "Sim. 30 dias completos, com acesso a todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito e você pode encerrar quando quiser." },
        { q: "Preciso instalar algo?", a: "Não. Approva é 100% web. Funciona em qualquer navegador moderno, no computador ou no celular." },
        { q: "Meus dados ficam seguros?", a: "Sim. Toda a infraestrutura é criptografada, com backups diários. Acesso por usuário com autenticação individual e trilha de aprovação de despesas." },
        { q: "Atende a quais editais e legislações?", a: "Hoje exportamos no padrão SIT/TCE-PR, com CNPJs validados, encoding ANSI Win-1252 e catálogo de naturezas econômicas oficiais. Outros formatos podem ser adicionados conforme necessidade." },
        { q: "Posso trocar de plano depois?", a: "Sim. Você pode aumentar ou reduzir o plano a qualquer momento, sem multa." },
      ]} />
    </MarketingLayout>
  );
}
