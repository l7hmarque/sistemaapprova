import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Approva" },
      { name: "description", content: "Termos de Uso da plataforma Approva, operada pela 3RD TECH." },
    ],
    links: [{ rel: "canonical", href: "https://synsit.lovable.app/termos" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-6 py-16 prose-styled">
        <h1 className="text-4xl md:text-5xl font-serif text-brand-navy">Termos de Uso</h1>
        <p className="mt-2 text-sm text-brand-muted">Última atualização: maio de 2026</p>

        <h2 className="mt-10 text-2xl font-serif text-brand-navy">1. Aceitação</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Ao contratar ou utilizar a plataforma Approva, operada pela 3RD TECH, o
          contratante declara estar ciente e de acordo com estes Termos.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">2. Objeto</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          O Approva é uma plataforma de gestão financeira e prestação de contas
          voltada a organizações da sociedade civil (OSCs) e escritórios contábeis
          que atendem o terceiro setor.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">3. Confidencialidade e propriedade intelectual</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          A arquitetura, funcionalidades, fluxos internos, métodos de processamento,
          algoritmos, regras de negócio e quaisquer características técnicas da
          plataforma são de propriedade exclusiva da 3RD TECH e constituem
          informação confidencial. O contratante e seus usuários se comprometem a
          não realizar engenharia reversa, copiar, descompilar ou tentar descobrir,
          por qualquer meio, o funcionamento interno da plataforma, nem divulgar a
          terceiros suposições sobre seu funcionamento.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">4. Demonstração gratuita</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Novos contratantes têm acesso a 30 dias de demonstração, sem cobrança e
          sem fidelidade. Após esse período, a continuidade depende da contratação
          de um plano vigente.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">5. Pagamento e cancelamento</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Os planos são mensais. Não há multa por cancelamento. O cancelamento
          encerra o acesso ao final do ciclo já pago.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">6. Disponibilidade</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          A 3RD TECH empenha esforços razoáveis para manter a plataforma disponível,
          mas não garante operação ininterrupta, podendo realizar manutenções
          programadas mediante aviso prévio.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">7. Foro</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Fica eleito o foro da Comarca de Medianeira/PR para dirimir quaisquer
          questões oriundas destes Termos.
        </p>
      </article>
    </MarketingLayout>
  );
}
