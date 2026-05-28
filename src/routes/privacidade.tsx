import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Approva" },
      { name: "description", content: "Como o Approva trata dados pessoais e financeiros, conforme a LGPD." },
    ],
    links: [{ rel: "canonical", href: "https://synsit.lovable.app/privacidade" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-serif text-brand-navy">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-brand-muted">Última atualização: maio de 2026</p>

        <h2 className="mt-10 text-2xl font-serif text-brand-navy">Dados coletados</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Coletamos dados de identificação (nome, email, telefone, cargo), dados da
          organização (nome, CNPJ quando aplicável) e dados de uso da plataforma
          (lançamentos, documentos, relatórios) inseridos pelo próprio contratante.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">Finalidade</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Os dados são utilizados exclusivamente para prestação do serviço, suporte,
          comunicação operacional e cumprimento de obrigações legais.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">Compartilhamento</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Não comercializamos dados. Compartilhamos apenas com provedores de
          infraestrutura essenciais à operação (hospedagem, backup, envio de email),
          sob obrigação contratual de confidencialidade.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">Direitos do titular (LGPD)</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          O titular pode solicitar acesso, correção, portabilidade e exclusão de
          seus dados pessoais a qualquer momento, pelo formulário de contato.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">Cookies e rastreio</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Utilizamos cookies próprios e de terceiros (analytics e remarketing) para
          medir audiência das nossas páginas públicas e otimizar campanhas. Você pode
          desativar cookies no seu navegador.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">Retenção</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Dados são retidos enquanto durar a relação contratual e pelos prazos legais
          aplicáveis. Após esse período, são excluídos ou anonimizados.
        </p>

        <h2 className="mt-8 text-2xl font-serif text-brand-navy">Contato</h2>
        <p className="mt-3 text-brand-muted leading-relaxed">
          Para exercer seus direitos ou esclarecer dúvidas: use o formulário em{" "}
          <a href="/demonstracao" className="text-brand-blue underline">/demonstracao</a>.
        </p>
      </article>
    </MarketingLayout>
  );
}
