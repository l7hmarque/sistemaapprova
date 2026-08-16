import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import escritorioShot from "@/assets/screens/escritorio.webp";

export const Route = createFileRoute("/contadores")({
  head: () => ({
    meta: [
      { title: "Sistema para escritório contábil que atende OSCs | Approva" },
      { name: "description", content: "Atenda várias OSCs no mesmo login: despesas com documento anexo, revisão e aprovação em fila e prestação de contas mensal em PDF único. 30 dias grátis." },
      { property: "og:title", content: "Approva para escritórios de contabilidade do terceiro setor" },
      { property: "og:description", content: "Carteira de OSCs em um painel, mês já lançado pelo cliente com documento anexo e relatório mensal pronto." },

      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sistemaapprova.lovable.app/contadores" },
    ],
    links: [{ rel: "canonical", href: "https://sistemaapprova.lovable.app/contadores" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Funciona para mais de uma OSC?", acceptedAnswer: { "@type": "Answer", text: "Sim. Você alterna entre as organizações da carteira no mesmo login, sem misturar dados. O plano Escritório atende até 5 OSCs; para mais entidades, fale conosco." } },
          { "@type": "Question", name: "O Approva exporta ou envia dados para o TCE ou para o SIT?", acceptedAnswer: { "@type": "Answer", text: "Não. Não há integração com sistemas de órgãos de controle. O Approva organiza os lançamentos, guarda os documentos e gera os relatórios e o PDF da prestação de contas que a sua equipe usa para fazer a entrega." } },
          { "@type": "Question", name: "O cliente lança e eu só reviso?", acceptedAnswer: { "@type": "Answer", text: "Sim. A OSC envia os documentos, o sistema cria as despesas já preenchidas e elas chegam a uma fila de aprovação. Você aprova ou devolve com o motivo, e tudo fica registrado." } },
          { "@type": "Question", name: "Dá para padronizar a classificação das despesas?", acceptedAnswer: { "@type": "Answer", text: "Sim. Você cria regras por fornecedor ou tipo de documento e o sistema passa a aplicar a mesma classificação automaticamente para toda a equipe." } },
          { "@type": "Question", name: "Tem treinamento da equipe?", acceptedAnswer: { "@type": "Answer", text: "Sim. Todos os planos incluem onboarding em vídeo. O plano Escritório inclui sessão ao vivo." } },
        ],

      }),
    }],
  }),
  component: ContadoresPage,
});

const VANTAGENS = [
  { t: "Carteira em um lugar só", d: "Todas as OSCs que você atende no mesmo login, com a situação do mês de cada uma e troca de cliente em um clique." },
  { t: "O cliente lança, você revisa", d: "A OSC envia os documentos, o sistema cria as despesas preenchidas e você aprova ou devolve com o motivo." },
  { t: "Regras de classificação", d: "Defina a classificação por fornecedor ou tipo de documento uma vez — o sistema repete sozinho para toda a equipe." },
  { t: "Prestação mensal em PDF único", d: "Modelo, certidões e comprovantes de cada despesa reunidos em um arquivo com sumário, pronto para o cliente entregar." },
  { t: "Relatório mensal de execução", d: "Repasses, despesas classificadas, resumo bancário e previsto x realizado, em PDF, por projeto ou termo." },
  { t: "Histórico por lançamento", d: "Edições, exclusões e aprovações registradas com autor e data, com os documentos vinculados a cada despesa." },
];


function ContadoresPage() {
  return (
    <MarketingLayout>
      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="text-xs uppercase tracking-widest text-brand-accent font-medium">Para escritórios contábeis</p>
          <h1 className="mt-4 text-5xl md:text-6xl font-serif text-white max-w-3xl leading-[1.05]">
            Atenda mais OSCs sem aumentar a equipe.
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl leading-relaxed">
            Approva padroniza a prestação de contas das organizações do terceiro setor
            que estão na sua carteira. Você ganha previsibilidade, seu cliente ganha
            tranquilidade.
          </p>
          <a href="/demonstracao?plano=escritorio&publico=contador" className="mt-10 inline-block rounded-md bg-brand-accent text-brand-navy px-6 py-3 font-medium hover:bg-brand-cream transition-colors">
            Quero ver na prática (30 dias grátis)
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Painel do escritório</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy">Toda sua carteira de OSCs em uma visão.</h2>
            <p className="mt-4 text-brand-muted leading-relaxed">
              Veja status de prestação por entidade — em dia, com pendências ou atrasadas — e clique para entrar no contexto de qualquer cliente sem precisar trocar de login.
            </p>
          </div>
          <div className="rounded-xl overflow-hidden border border-brand-line shadow-xl bg-white">
            <img src={escritorioShot} alt="Painel do escritório no Approva listando 6 OSCs com KPIs de status (em dia, com pendências, atrasadas) e cards por organização." loading="lazy" className="w-full h-auto" />
          </div>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {VANTAGENS.map((v) => (
            <div key={v.t} className="rounded-xl border border-brand-line p-6 bg-white">
              <h3 className="text-xl font-serif text-brand-navy">{v.t}</h3>
              <p className="mt-2 text-brand-muted text-sm leading-relaxed">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-cream-soft">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">O mês do cliente, padronizado</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy">
            Cada hora gasta em planilha é uma hora a menos com cliente.
          </h2>
          <p className="mt-6 text-brand-muted text-lg leading-relaxed">
            No Approva o documento chega junto do lançamento, a revisão acontece
            em uma fila só e o relatório do mês é gerado pelo próprio sistema. O
            Approva não se conecta ao TCE nem ao SIT: ele organiza os dados e
            entrega os documentos prontos para a sua equipe fazer o envio.
          </p>
        </div>
      </section>

      <PlanCards publico="contador" />

      <FaqAccordion items={[
        { q: "Funciona para mais de uma OSC?", a: "Sim. Você alterna entre as organizações da carteira no mesmo login, sem misturar dados. O plano Escritório atende até 5 OSCs; para mais entidades, fale conosco." },
        { q: "O Approva exporta ou envia dados para o TCE ou para o SIT?", a: "Não. Não há integração com sistemas de órgãos de controle. O Approva organiza os lançamentos, guarda os documentos e gera os relatórios e o PDF da prestação de contas que a sua equipe usa para fazer a entrega." },
        { q: "O cliente lança e eu só reviso?", a: "Sim. A OSC envia os documentos, o sistema cria as despesas já preenchidas e elas chegam a uma fila de aprovação. Você aprova ou devolve com o motivo, e tudo fica registrado." },
        { q: "Dá para padronizar a classificação das despesas?", a: "Sim. Você cria regras por fornecedor ou tipo de documento e o sistema passa a aplicar a mesma classificação automaticamente para toda a equipe." },
        { q: "Tem treinamento da equipe?", a: "Sim. Todos os planos incluem onboarding em vídeo. O plano Escritório inclui sessão ao vivo." },
      ]} />

    </MarketingLayout>
  );
}
