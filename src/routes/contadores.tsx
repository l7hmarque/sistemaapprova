import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";

export const Route = createFileRoute("/contadores")({
  head: () => ({
    meta: [
      { title: "SynSIT para Contadores e Escritórios do Terceiro Setor" },
      { name: "description", content: "Padronize a prestação de contas de várias OSCs em um único painel. Modelos prontos, exportação SIT, multi-cliente. 30 dias grátis." },
      { property: "og:title", content: "SynSIT para Contadores que atendem OSCs" },
      { property: "og:description", content: "Multi-OSC, modelos por edital, exportação SIT. Sem retrabalho." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://synsit.lovable.app/contadores" },
    ],
    links: [{ rel: "canonical", href: "https://synsit.lovable.app/contadores" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Funciona para mais de uma OSC?", acceptedAnswer: { "@type": "Answer", text: "Sim. O plano Escritório atende até 5 OSCs com painel consolidado. Para mais entidades, fale conosco — temos condições por carteira." } },
          { "@type": "Question", name: "Posso importar dados de planilhas que já uso?", acceptedAnswer: { "@type": "Answer", text: "Sim. Na implantação ajudamos na migração inicial dos saldos e fornecedores ativos." } },
          { "@type": "Question", name: "E se o TCE atualizar o layout SIT?", acceptedAnswer: { "@type": "Answer", text: "Mantemos o sistema atualizado conforme as portarias do TCE-PR. Atualizações de layout não geram custo adicional." } },
          { "@type": "Question", name: "Tem treinamento da equipe?", acceptedAnswer: { "@type": "Answer", text: "Sim. Todos os planos incluem onboarding em vídeo. Plano Escritório inclui sessão ao vivo." } },
        ],
      }),
    }],
  }),
  component: ContadoresPage,
});

const VANTAGENS = [
  { t: "Carteira em um lugar só", d: "Veja todas as OSCs sob sua responsabilidade num painel único, com status de prestação por entidade." },
  { t: "Modelos por edital", d: "Templates de orçamento, mapa de cotação e relatórios prontos para os principais convênios e termos de fomento." },
  { t: "Exportação SIT (TCE-PR)", d: "Geração do arquivo Despesa.txt no padrão oficial, sem ajuste manual de campos." },
  { t: "Padronização da equipe", d: "Mesmo fluxo para todo o time — reduz retrabalho e dependência de quem lançou cada despesa." },
  { t: "Auditoria interna facilitada", d: "Histórico completo por evento financeiro, com rastreabilidade de documentos vinculados." },
  { t: "Logo do escritório nos relatórios", d: "Entregue a prestação de contas mensal com sua marca, para reforço de autoridade frente ao cliente." },
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
            SynSIT padroniza a prestação de contas das organizações do terceiro setor
            que estão na sua carteira. Você ganha previsibilidade, seu cliente ganha
            tranquilidade.
          </p>
          <a href="/demonstracao?plano=escritorio&publico=contador" className="mt-10 inline-block rounded-md bg-brand-accent text-brand-navy px-6 py-3 font-medium hover:bg-brand-cream transition-colors">
            Quero ver na prática (30 dias grátis)
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

      <section className="bg-brand-cream-soft">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Quanto custa <i>não</i> ter</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy">
            Cada hora gasta em planilha é uma hora a menos com cliente.
          </h2>
          <p className="mt-6 text-brand-muted text-lg leading-relaxed">
            Escritórios que atendem 3 a 5 OSCs com SynSIT reportam economia de
            <strong className="text-brand-navy"> 8 a 14 horas mensais</strong> só em fechamento
            e organização documental.
          </p>
        </div>
      </section>

      <PlanCards publico="contador" />

      <FaqAccordion items={[
        { q: "Funciona para mais de uma OSC?", a: "Sim. O plano Escritório atende até 5 OSCs com painel consolidado. Para mais entidades, fale conosco — temos condições por carteira." },
        { q: "Posso importar dados de planilhas que já uso?", a: "Sim. Na implantação ajudamos na migração inicial dos saldos e fornecedores ativos." },
        { q: "E se o TCE atualizar o layout SIT?", a: "Mantemos o sistema atualizado conforme as portarias do TCE-PR. Atualizações de layout não geram custo adicional." },
        { q: "Tem treinamento da equipe?", a: "Sim. Todos os planos incluem onboarding em vídeo. Plano Escritório inclui sessão ao vivo." },
      ]} />
    </MarketingLayout>
  );
}
