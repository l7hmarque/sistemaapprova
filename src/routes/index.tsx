import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { FluxoMensal } from "@/components/marketing/FluxoMensal";
import previewCaptura from "@/assets/screens/captura.webp";
import previewPrestacao from "@/assets/screens/prestacao.webp";
import previewPainel from "@/assets/screens/painel.webp";

const SITE = "https://sistemaapprova.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Approva — Prestação de contas de OSCs, sem planilha paralela" },
      {
        name: "description",
        content:
          "Software para gestão financeira e prestação de contas de OSCs e escritórios contábeis. Feche o mês do seu convênio ou termo de fomento em horas — pronto para TCE-PR e prestações municipais. 30 dias grátis.",
      },
      { property: "og:title", content: "Approva — Prestação de contas para OSCs, sem planilha paralela" },
      {
        property: "og:description",
        content:
          "Documentos capturados sem digitação, aprovação em duas mãos e exportação pronta para o órgão repassador. 30 dias grátis, sem cartão.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: `${SITE}${previewPrestacao}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE}${previewPrestacao}` },
    ],
    links: [
      { rel: "canonical", href: `${SITE}/` },
      { rel: "preload", as: "image", href: previewPrestacao, fetchPriority: "high" } as any,
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "3RD TECH",
          url: SITE,
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
          url: `${SITE}/`,
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
          url: `${SITE}/`,
          description:
            "Plataforma de gestão financeira e prestação de contas para OSCs e escritórios contábeis do terceiro setor. Captura sem digitação, aprovação em duas mãos e exportação para TCE-PR e prestações municipais.",
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
            { "@type": "Question", name: "Preciso de conhecimento técnico para usar?", acceptedAnswer: { "@type": "Answer", text: "Não. O Approva foi desenhado para gestores de OSC e equipes financeiras que hoje operam em planilha. A curva é curta e o onboarding é guiado." } },
            { "@type": "Question", name: "Funciona para prestações municipais além do TCE-PR?", acceptedAnswer: { "@type": "Answer", text: "Sim. Além da exportação no padrão oficial do TCE-PR, o Approva organiza a prestação de contas para termos e convênios municipais — o relatório PDF fica pronto para envio ao órgão repassador." } },
            { "@type": "Question", name: "Atende à Lei 13.019 (MROSC)?", acceptedAnswer: { "@type": "Answer", text: "Sim. O sistema respeita a lógica de projeto/termo/convênio da Lei 13.019, com controle por rubrica, comprovação anexa e trilha auditável de aprovação." } },
            { "@type": "Question", name: "O que acontece com o mês depois de fechado?", acceptedAnswer: { "@type": "Answer", text: "Períodos homologados ficam imutáveis. Qualquer ajuste posterior gera um evento de correção rastreável — nada é apagado silenciosamente." } },
            { "@type": "Question", name: "Meus dados ficam seguros?", acceptedAnswer: { "@type": "Answer", text: "Sim. Infraestrutura criptografada, backups diários, acesso individual por usuário e trilha completa de auditoria. Aderência à LGPD." } },
            { "@type": "Question", name: "Posso trocar de plano depois?", acceptedAnswer: { "@type": "Answer", text: "Sim. Você pode aumentar ou reduzir o plano a qualquer momento, sem multa." } },
          ],
        }),
      },
    ],
  }),
  component: HomePage,
});

const DORES = [
  {
    t: "Planilha paralela que ninguém mais entende",
    d: "Cada mês vira uma cópia da anterior, com fórmulas quebradas e histórico perdido. Quando o financiador pede, ninguém sabe qual arquivo é o oficial.",
    fix: "Base única, versionada, com histórico por termo e mês.",
  },
  {
    t: "Comprovante que sumiu no email",
    d: "Boleto, NF-e e holerite chegam por WhatsApp, email e envelope. Na hora do fechamento, meia hora buscando cada anexo.",
    fix: "Todo documento entra no Approva e fica preso ao lançamento certo.",
  },
  {
    t: "Retrabalho no fim do mês",
    d: "Contador redigita o que a OSC já lançou; a OSC refaz o que o contador ajustou. Duas pessoas, o mesmo dado, duas vezes.",
    fix: "Um único fluxo compartilhado — sem exportar planilha para colar em outro sistema.",
  },
  {
    t: "Medo do apontamento no controle externo",
    d: "Uma rubrica errada, um CNPJ com dígito trocado, e o parecer volta com ressalva. A insegurança consome mais tempo que o próprio lançamento.",
    fix: "Validações na hora do lançamento e exportação no formato oficial exigido.",
  },
];

const FEATURES = [
  {
    t: "Captura sem digitação",
    d: "Envie o PDF do mês ou os documentos avulsos — NF-e, boleto, holerite, guia. O sistema lê e propõe a categoria certa para você conferir.",
  },
  {
    t: "Comprovação sempre anexa",
    d: "Cada despesa carrega seu próprio comprovante. Nada de pasta física ou drive paralelo.",
  },
  {
    t: "Aprovação em duas mãos",
    d: "Solicitante e responsável assinam cada gasto. Trilha auditável de quem aprovou o quê e quando.",
  },
  {
    t: "Financeiro por termo",
    d: "Saldo, execução por rubrica e próximo repasse por convênio ou termo de fomento — a resposta que a diretoria pede na hora que ela pergunta.",
  },
  {
    t: "Arquivos organizados em nuvem",
    d: "Sincronização opcional com Google Drive: cada mês vira uma pasta com todos os comprovantes ordenados.",
  },
  {
    t: "Exportações prontas",
    d: "Relatório PDF para conselho e financiador, e arquivo no formato oficial do TCE-PR ou do órgão municipal.",
  },
];

function HomePage() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative bg-brand-cream overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
              Plataforma Approva · por 3RD TECH
            </p>
            <h1 className="mt-4 text-4xl md:text-6xl font-serif text-brand-navy leading-[1.05]">
              Feche o mês da sua OSC <em className="not-italic text-brand-blue">em horas</em>, com cada real comprovado.
            </h1>
            <p className="mt-6 text-lg text-brand-muted max-w-xl leading-relaxed">
              Gestão financeira e prestação de contas para convênios e termos
              de fomento — pronto para o TCE-PR e para prestações municipais.
              Sem planilha paralela, sem retrabalho entre gestor e contador.
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
                alt="Painel de Prestação do Convênio 042/2025 no Approva: total do mês, quantos documentos já têm comprovante e tabela de lançamentos aprovados e pendentes."
                width={1600}
                height={896}
                fetchPriority="high"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* DORES */}
      <section className="bg-white border-y border-brand-line">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
              Dores que resolvemos
            </p>
            <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
              O que o mês de fechamento parece hoje — e não precisa parecer.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {DORES.map((d) => (
              <div key={d.t} className="rounded-xl border border-brand-line bg-brand-cream-soft p-6">
                <h3 className="text-xl font-serif text-brand-navy">{d.t}</h3>
                <p className="mt-3 text-brand-muted text-sm leading-relaxed">{d.d}</p>
                <p className="mt-4 text-sm text-brand-navy font-medium">
                  <span className="text-brand-blue">→ </span>
                  {d.fix}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Como funciona</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
            Três passos, um único lugar.
          </h2>
          <p className="mt-4 text-brand-muted leading-relaxed">
            Do repasse recebido até o relatório entregue ao órgão — com
            comprovação documental anexa em cada linha.
          </p>
        </div>

        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          <li>
            <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
              <img
                src={previewCaptura}
                alt="Tela de Captura do Approva: área de upload de PDF e XMLs com fila de leitura mostrando NF-e, boletos e holerites já reconhecidos."
                loading="lazy"
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-brand-blue font-serif text-2xl">01</span>
              <h3 className="text-xl font-serif text-brand-navy">Capture os documentos</h3>
            </div>
            <p className="mt-2 text-brand-muted leading-relaxed">
              Suba o PDF do mês ou os documentos avulsos. O Approva lê e
              propõe categoria, fornecedor e valor — você só confere.
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
              <h3 className="text-xl font-serif text-brand-navy">Organize por mês e aprove</h3>
            </div>
            <p className="mt-2 text-brand-muted leading-relaxed">
              Cada despesa fica com o comprovante anexo, categoria certa e
              dupla assinatura registrada. O painel mostra o que falta.
            </p>
          </li>
          <li>
            <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
              <img
                src={previewPainel}
                alt="Painel financeiro do Approva mostrando saldo do termo, próximo repasse e execução por rubrica."
                loading="lazy"
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-brand-blue font-serif text-2xl">03</span>
              <h3 className="text-xl font-serif text-brand-navy">Exporte para o órgão</h3>
            </div>
            <p className="mt-2 text-brand-muted leading-relaxed">
              Relatório PDF para conselho e financiador; arquivo no padrão
              oficial do TCE-PR ou do controle municipal, com um clique.
            </p>
          </li>
        </ol>
      </section>

      {/* INFOGRÁFICO — FLUXO MENSAL */}
      <FluxoMensal />

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
            Um sistema, não um exportador
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
            O que o Approva faz pelo seu financeiro.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-xl border border-brand-line bg-white p-6">
              <h3 className="text-lg font-serif text-brand-navy">{f.t}</h3>
              <p className="mt-2 text-brand-muted text-sm leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEGMENTOS */}
      <section className="mx-auto max-w-6xl px-6 pb-4 grid gap-6 md:grid-cols-2">
        <Link
          to="/contadores"
          className="group rounded-2xl border border-brand-line p-10 hover:border-brand-navy transition-colors"
        >
          <div className="text-xs uppercase tracking-widest text-brand-blue font-medium">Para escritórios contábeis</div>
          <h2 className="mt-3 text-3xl font-serif text-brand-navy">Contadores que atendem OSCs</h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            Padronize a prestação mensal de toda a carteira do terceiro setor.
            Menos retrabalho, mais lastro auditável.
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
            Feche o mês do seu termo em horas, não em dias. Comprovante
            anexado, aprovação registrada e exportação pronta.
          </p>
          <div className="mt-6 text-brand-blue font-medium group-hover:underline underline-offset-4">
            Ver vantagens para gestores →
          </div>
        </Link>
      </section>

      {/* SEGURANÇA & LASTRO */}
      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-brand-accent font-medium">
              Segurança & lastro auditável
            </p>
            <h2 className="mt-3 text-3xl md:text-4xl font-serif text-white leading-tight">
              Feito para aguentar auditoria — porque OSC boa aguenta.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Período homologado é imutável", d: "Fechou o mês, ninguém mais altera. Ajustes viram evento de correção rastreável." },
              { t: "Trilha completa de auditoria", d: "Cada aprovação, edição e exclusão fica registrada com autor, data e motivo." },
              { t: "Criptografia e backup diário", d: "Dados protegidos em trânsito e em repouso; backups automáticos todos os dias." },
              { t: "Multi-cliente para escritórios", d: "Contador vê várias OSCs sem misturar dados. Cada organização isolada por padrão." },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-white/15 p-6">
                <h3 className="text-lg font-serif text-white">{c.t}</h3>
                <p className="mt-2 text-white/80 text-sm leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PlanCards />

      <FaqAccordion items={[
        { q: "A demonstração é mesmo gratuita?", a: "Sim. 30 dias completos, com acesso a todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito e você pode encerrar quando quiser." },
        { q: "Preciso de conhecimento técnico para usar?", a: "Não. O Approva foi desenhado para gestores de OSC e equipes financeiras que hoje operam em planilha. A curva é curta e o onboarding é guiado." },
        { q: "Funciona para prestações municipais além do TCE-PR?", a: "Sim. Além da exportação no padrão oficial do TCE-PR, o Approva organiza a prestação de contas para termos e convênios municipais — o relatório PDF fica pronto para envio ao órgão repassador." },
        { q: "Atende à Lei 13.019 (MROSC)?", a: "Sim. O sistema respeita a lógica de projeto/termo/convênio da Lei 13.019, com controle por rubrica, comprovação anexa e trilha auditável de aprovação." },
        { q: "O que acontece com o mês depois de fechado?", a: "Períodos homologados ficam imutáveis. Qualquer ajuste posterior gera um evento de correção rastreável — nada é apagado silenciosamente." },
        { q: "Meus dados ficam seguros?", a: "Sim. Infraestrutura criptografada, backups diários, acesso individual por usuário e trilha completa de auditoria. Aderência à LGPD." },
        { q: "Posso trocar de plano depois?", a: "Sim. Você pode aumentar ou reduzir o plano a qualquer momento, sem multa." },
      ]} />
    </MarketingLayout>
  );
}
