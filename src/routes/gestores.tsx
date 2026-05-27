import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";

export const Route = createFileRoute("/gestores")({
  head: () => ({
    meta: [
      { title: "SynSIT para Gestores e Equipes Financeiras de OSCs" },
      { name: "description", content: "Menos planilha, mais missão. Controle orçamento, prestação de contas e prazos da sua OSC em um único lugar. 30 dias grátis." },
      { property: "og:title", content: "SynSIT para Gestores de OSCs" },
      { property: "og:description", content: "Acompanhe orçamento, metas e prazos da sua OSC sem planilhas paralelas." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://synsit.lovable.app/gestores" },
    ],
    links: [{ rel: "canonical", href: "https://synsit.lovable.app/gestores" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Minha OSC é pequena, vale a pena?", acceptedAnswer: { "@type": "Answer", text: "Sim. O plano Essencial foi pensado para OSCs em início ou pequeno porte. Você organiza desde já e cresce sem precisar trocar de sistema." } },
          { "@type": "Question", name: "Como funciona com convênios e termos de fomento?", acceptedAnswer: { "@type": "Answer", text: "Você cadastra cada projeto/convênio e vincula despesas. O sistema gera relatórios por fonte de recurso, prontos para prestação." } },
          { "@type": "Question", name: "Posso dar acesso para meu contador?", acceptedAnswer: { "@type": "Answer", text: "Sim. Cada plano inclui usuários adicionais. Seu contador acessa o que precisa para fechar o mês — sem trocar email com planilha." } },
          { "@type": "Question", name: "E LGPD?", acceptedAnswer: { "@type": "Answer", text: "Tratamos dados conforme a LGPD. Apenas pessoas com acesso autorizado visualizam informações da OSC." } },
        ],
      }),
    }],
  }),
  component: GestoresPage,
});

const VANTAGENS = [
  { t: "Menos papelada, mais causa", d: "Reduza o tempo gasto com lançamentos e fechamentos. Sua equipe volta a focar nos projetos." },
  { t: "Visão clara do orçamento", d: "Acompanhe o realizado vs. previsto por projeto, rubrica e convênio em tempo real." },
  { t: "Prestação de contas tranquila", d: "Documentos organizados, lançamentos rastreáveis. Quando o conselho ou financiador pedir, está pronto." },
  { t: "Alertas de prazo", d: "Calendário fiscal e prazos de prestação com lembretes — nunca mais perca uma data." },
  { t: "Acesso por papel", d: "Coordenação, financeiro e direção acessam o que precisam — com segurança e histórico." },
  { t: "Relatórios para o conselho", d: "Exporte demonstrativos prontos para reuniões de diretoria e assembleias." },
];

function GestoresPage() {
  return (
    <MarketingLayout>
      <section className="bg-brand-cream">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Para gestores de OSCs</p>
          <h1 className="mt-4 text-5xl md:text-6xl font-serif text-brand-navy max-w-3xl leading-[1.05]">
            Mais tempo para a missão. Menos tempo com planilha.
          </h1>
          <p className="mt-6 text-lg text-brand-muted max-w-2xl leading-relaxed">
            SynSIT organiza a vida financeira da sua OSC — orçamento, lançamentos,
            documentos e prestação de contas — num só lugar, com visão clara para
            quem coordena e segurança para quem audita.
          </p>
          <a
            href="/demonstracao?plano=profissional&publico=gestor"
            className="mt-10 inline-block rounded-md bg-brand-navy text-white px-6 py-3 font-medium hover:bg-brand-navy-soft transition-colors"
          >
            Quero testar 30 dias grátis
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {VANTAGENS.map((v) => (
            <div key={v.t} className="rounded-xl border border-brand-line p-6 bg-white">
              <h3 className="text-xl font-serif text-brand-navy">{v.t}</h3>
              <p className="mt-2 text-brand-muted text-sm leading-relaxed">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-xs uppercase tracking-widest text-brand-accent font-medium">Para quem cuida do que importa</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-serif text-white">
            A sua causa merece uma operação à altura.
          </h2>
          <p className="mt-6 text-white/85 text-lg leading-relaxed">
            OSCs que adotam o SynSIT relatam fechamentos mensais
            <strong className="text-brand-accent"> até 3x mais rápidos</strong> e
            redução significativa de erros em prestações de contas.
          </p>
        </div>
      </section>

      <PlanCards publico="gestor" />

      <FaqAccordion items={[
        { q: "Minha OSC é pequena, vale a pena?", a: "Sim. O plano Essencial foi pensado para OSCs em início ou pequeno porte. Você organiza desde já e cresce sem precisar trocar de sistema." },
        { q: "Como funciona com convênios e termos de fomento?", a: "Você cadastra cada projeto/convênio e vincula despesas. O sistema gera relatórios por fonte de recurso, prontos para prestação." },
        { q: "Posso dar acesso para meu contador?", a: "Sim. Cada plano inclui usuários adicionais. Seu contador acessa o que precisa para fechar o mês — sem trocar email com planilha." },
        { q: "E LGPD?", a: "Tratamos dados conforme a LGPD. Apenas pessoas com acesso autorizado visualizam informações da OSC." },
      ]} />
    </MarketingLayout>
  );
}
