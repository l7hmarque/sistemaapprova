import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PlanCards } from "@/components/marketing/PlanCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { FluxoMensal } from "@/components/marketing/FluxoMensal";
import previewCaptura from "@/assets/screens/captura.webp";
import previewPrestacao from "@/assets/screens/prestacao.webp";
import previewPainel from "@/assets/screens/painel.webp";

const SITE = "https://sistemaapprova.lovable.app";

const FAQ = [
  {
    q: "O Approva envia os dados direto para o TCE ou para o SIT?",
    a: "Não. O Approva não tem integração com TCE, SIT ou sistema de nenhum órgão. O que ele faz é organizar as despesas, guardar os comprovantes e gerar os relatórios e o PDF da prestação de contas do mês — você usa esse material para fazer a entrega onde a sua OSC precisa entregar.",
  },
  {
    q: "Como o sistema lê os documentos que eu envio?",
    a: "Você envia o PDF do mês (mesmo com vários documentos dentro) ou os arquivos avulsos. O Approva separa cada documento, identifica fornecedor, valor e datas e cria uma despesa para cada um. Você só confere e confirma.",
  },
  {
    q: "O que sai no PDF da prestação de contas?",
    a: "Um arquivo único com o seu documento-modelo, as certidões e documentos cadastrados no mês e todos os comprovantes das despesas (nota fiscal, boleto e comprovante de pagamento), na ordem, com sumário.",
  },
  {
    q: "Preciso cadastrar as certidões todo mês?",
    a: "Não. Ao cadastrar um documento você informa até quando ele vale. Enquanto estiver válido, ele entra automaticamente na prestação dos meses seguintes.",
  },
  {
    q: "Dá para atender mais de uma OSC no mesmo login?",
    a: "Sim. Escritórios de contabilidade alternam entre as organizações que atendem sem misturar dados, e cada OSC convida a própria equipe por e-mail.",
  },
  {
    q: "Preciso entender de contabilidade para usar?",
    a: "Não para o dia a dia. Enviar documento, conferir e aprovar é simples. As partes mais técnicas, como a classificação da despesa, ficam pré-preenchidas e podem ser revisadas por quem cuida da contabilidade.",
  },
  {
    q: "A demonstração é gratuita?",
    a: "Sim, 30 dias, sem cartão de crédito. Você pode encerrar quando quiser.",
  },
];

const RECURSOS = [
  {
    t: "Leitura automática dos documentos",
    d: "Envie um PDF com nota fiscal, boleto, holerite e comprovante juntos. Cada documento vira uma despesa separada, já com fornecedor, valor e datas preenchidos para você conferir.",
  },
  {
    t: "Painel do mês",
    d: "Todas as despesas do mês em uma tela: o que já tem comprovante, o que está faltando, filtro por mês e por projeto.",
  },
  {
    t: "Prestação de contas em um PDF só",
    d: "O sistema junta o seu documento-modelo, as certidões cadastradas e os comprovantes de cada despesa em um único arquivo, com sumário e sem páginas repetidas.",
  },
  {
    t: "Certidões que se renovam sozinhas",
    d: "Documento com validade de vários meses continua aparecendo na prestação até a data de vencimento — e o sistema avisa quando está perto de vencer.",
  },
  {
    t: "Relatório mensal de execução",
    d: "Repasses recebidos, despesas classificadas, resumo bancário e comparação entre previsto e realizado, tudo em PDF.",
  },
  {
    t: "Saldo por projeto ou termo",
    d: "Quanto foi aprovado, quanto já entrou, quanto foi gasto e quanto resta em cada convênio ou termo de fomento.",
  },
  {
    t: "Cotação com três orçamentos",
    d: "Envie o pedido de orçamento por e-mail aos fornecedores, compare os preços recebidos, gere o mapa comparativo e transforme o vencedor em despesa.",
  },
  {
    t: "Fornecedores e regras de classificação",
    d: "Cadastre o fornecedor uma vez e defina a regra: nas próximas despesas o sistema já aplica a mesma classificação sozinho.",
  },
  {
    t: "Todos os arquivos organizados",
    d: "Os documentos do ano ficam separados por seção, com busca e download direto — sem depender de pasta física ou e-mail antigo.",
  },
];

const PARA_OSC = [
  "Pare de montar pasta e caçar comprovante no WhatsApp: tudo entra pelo sistema e fica junto da despesa.",
  "Veja na hora quais despesas do mês ainda estão sem nota ou sem comprovante de pagamento.",
  "Saiba o saldo de cada convênio ou termo antes de autorizar um novo gasto.",
  "Gere o PDF da prestação do mês para entregar ao órgão que repassou o recurso.",
  "Faça a cotação de três orçamentos e o mapa comparativo dentro do próprio sistema.",
  "Convide a coordenação, o financeiro e a diretoria com acesso individual.",
];

const PARA_CONTABIL = [
  "Atenda várias OSCs no mesmo login, alternando de cliente sem misturar dados.",
  "Receba o mês já lançado pela OSC, com documento anexado — sem redigitar planilha.",
  "Revise e aprove as despesas em uma fila só, devolvendo com motivo quando faltar algo.",
  "Padronize a classificação por fornecedor com regras, para toda a equipe lançar igual.",
  "Baixe o relatório mensal de execução e o pacote completo de documentos do cliente.",
  "Consulte o histórico de edições, exclusões e aprovações de cada lançamento.",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Approva — Sistema de prestação de contas para OSCs" },
      {
        name: "description",
        content:
          "Sistema para OSCs e escritórios de contabilidade do terceiro setor: organiza as despesas do mês, guarda os comprovantes e gera a prestação de contas em um PDF único. 30 dias grátis.",
      },
      { property: "og:title", content: "Approva — Sistema de prestação de contas para OSCs" },
      {
        property: "og:description",
        content:
          "Envie os documentos, confira as despesas e gere a prestação de contas do mês em um PDF único, com todos os comprovantes anexos.",
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
          address: {
            "@type": "PostalAddress",
            addressLocality: "Medianeira",
            addressRegion: "PR",
            addressCountry: "BR",
          },
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
            "Sistema de gestão financeira e prestação de contas para OSCs e escritórios de contabilidade do terceiro setor: leitura automática de documentos, controle de despesas por projeto, cotação com mapa comparativo e geração da prestação de contas mensal em PDF único.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "BRL",
            description: "30 dias grátis",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: HomePage,
});

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
              Organize as despesas da sua OSC e feche a{" "}
              <em className="not-italic text-brand-blue">prestação de contas do mês</em> em um PDF
              só.
            </h1>
            <p className="mt-6 text-lg text-brand-muted max-w-xl leading-relaxed">
              Você envia os documentos, o Approva lê, separa cada despesa e monta o relatório do mês
              com todos os comprovantes anexos. Feito para OSCs e para escritórios de contabilidade
              que atendem o terceiro setor.
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
              Sem cartão de crédito · Sem fidelidade · Suporte em português
            </p>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-4 bg-brand-blue/5 rounded-3xl blur-2xl"
              aria-hidden="true"
            />
            <div className="relative rounded-xl overflow-hidden border border-brand-line shadow-2xl bg-white">
              <img
                src={previewPrestacao}
                alt="Tela de prestação de contas do Approva mostrando o total do mês, quantas despesas já têm comprovante e a lista de documentos do período."
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* PARA QUEM É */}
      <section className="bg-white border-y border-brand-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-serif text-brand-navy leading-tight max-w-2xl">
            Para quem é o Approva
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-line p-8 bg-brand-cream-soft">
              <div className="text-xs uppercase tracking-widest text-brand-blue font-medium">
                Para a sua OSC
              </div>
              <h3 className="mt-3 text-2xl font-serif text-brand-navy">
                Quem cuida do financeiro da organização
              </h3>
              <p className="mt-3 text-brand-muted leading-relaxed">
                Chega de montar pasta no fim do mês. Você envia os documentos ao longo do período,
                vê o que ainda falta e gera a prestação de contas para entregar a quem repassou o
                recurso.
              </p>
              <Link
                to="/gestores"
                className="mt-6 inline-block text-brand-blue font-medium hover:underline underline-offset-4"
              >
                Ver como funciona para gestores de OSC →
              </Link>
            </div>
            <div className="rounded-2xl border border-brand-line p-8 bg-brand-cream-soft">
              <div className="text-xs uppercase tracking-widest text-brand-blue font-medium">
                Para escritórios de contabilidade
              </div>
              <h3 className="mt-3 text-2xl font-serif text-brand-navy">Quem atende várias OSCs</h3>
              <p className="mt-3 text-brand-muted leading-relaxed">
                Todas as organizações da sua carteira no mesmo login. O cliente lança com o
                documento anexo, você revisa, aprova e baixa o pacote do mês pronto.
              </p>
              <Link
                to="/contadores"
                className="mt-6 inline-block text-brand-blue font-medium hover:underline underline-offset-4"
              >
                Ver como funciona para contabilidade →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
            Como funciona
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
            Três passos, do documento ao relatório.
          </h2>
          <p className="mt-4 text-brand-muted leading-relaxed">
            O mesmo caminho todo mês, sem planilha paralela e sem procurar comprovante solto no
            e-mail.
          </p>
        </div>

        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          <li>
            <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
              <img
                src={previewCaptura}
                alt="Tela de envio de documentos do Approva com a fila de leitura mostrando notas fiscais, boletos e holerites já reconhecidos."
                loading="lazy"
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-brand-blue font-serif text-2xl">01</span>
              <h3 className="text-xl font-serif text-brand-navy">Envie os documentos</h3>
            </div>
            <p className="mt-2 text-brand-muted leading-relaxed">
              Um PDF com vários documentos dentro ou arquivos avulsos. O sistema separa cada um e já
              preenche fornecedor, valor e datas.
            </p>
          </li>
          <li>
            <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
              <img
                src={previewPrestacao}
                alt="Lista de despesas do mês no Approva, com valor, documento anexado e situação de aprovação de cada lançamento."
                loading="lazy"
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-brand-blue font-serif text-2xl">02</span>
              <h3 className="text-xl font-serif text-brand-navy">Confira e aprove</h3>
            </div>
            <p className="mt-2 text-brand-muted leading-relaxed">
              Cada despesa fica com o comprovante junto. A fila de aprovação mostra o que falta e
              registra quem aprovou.
            </p>
          </li>
          <li>
            <div className="rounded-lg overflow-hidden border border-brand-line shadow-md bg-brand-cream">
              <img
                src={previewPainel}
                alt="Painel financeiro do Approva com o total do mês, o saldo do projeto e a execução das despesas."
                loading="lazy"
                width={1600}
                height={896}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-brand-blue font-serif text-2xl">03</span>
              <h3 className="text-xl font-serif text-brand-navy">Gere o relatório do mês</h3>
            </div>
            <p className="mt-2 text-brand-muted leading-relaxed">
              A prestação de contas sai em um PDF único, com sumário, certidões e todos os
              comprovantes. É só baixar e entregar.
            </p>
          </li>
        </ol>
      </section>

      {/* INFOGRÁFICO — FLUXO MENSAL */}
      <FluxoMensal />

      {/* RECURSOS */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Recursos</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
            O que o Approva faz hoje.
          </h2>
          <p className="mt-4 text-brand-muted leading-relaxed">
            Tudo o que está listado abaixo já está no sistema e pode ser testado nos 30 dias
            gratuitos.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {RECURSOS.map((f) => (
            <div key={f.t} className="rounded-xl border border-brand-line bg-white p-6">
              <h3 className="text-lg font-serif text-brand-navy">{f.t}</h3>
              <p className="mt-2 text-brand-muted text-sm leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONTEÚDO SEPARADO POR PÚBLICO */}
      <section className="bg-brand-cream-soft border-y border-brand-line">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-serif text-brand-navy leading-tight max-w-2xl">
            O que muda no seu dia a dia
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-line bg-white p-8">
              <h3 className="text-2xl font-serif text-brand-navy">
                Se você é gestor ou financeiro de OSC
              </h3>
              <ul className="mt-5 space-y-3">
                {PARA_OSC.map((i) => (
                  <li key={i} className="flex gap-3 text-brand-muted text-sm leading-relaxed">
                    <span className="text-brand-blue" aria-hidden="true">
                      →
                    </span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/gestores"
                className="mt-6 inline-block text-brand-blue font-medium hover:underline underline-offset-4"
              >
                Página para gestores de OSC →
              </Link>
            </div>
            <div className="rounded-2xl border border-brand-line bg-white p-8">
              <h3 className="text-2xl font-serif text-brand-navy">
                Se você é de escritório de contabilidade
              </h3>
              <ul className="mt-5 space-y-3">
                {PARA_CONTABIL.map((i) => (
                  <li key={i} className="flex gap-3 text-brand-muted text-sm leading-relaxed">
                    <span className="text-brand-blue" aria-hidden="true">
                      →
                    </span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/contadores"
                className="mt-6 inline-block text-brand-blue font-medium hover:underline underline-offset-4"
              >
                Página para contabilidade →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* O QUE O APPROVA NÃO FAZ */}
      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-brand-accent font-medium">
              Transparência
            </p>
            <h2 className="mt-3 text-3xl md:text-4xl font-serif text-white leading-tight">
              O que o Approva faz — e o que ele não faz.
            </h2>
            <p className="mt-4 text-white/80 leading-relaxed">
              O Approva organiza os dados e gera os documentos da prestação de contas. Ele não se
              conecta a sistemas de órgãos públicos e não envia nada no seu lugar: a entrega
              continua sendo feita por você, com o material pronto em mãos.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                t: "Cada acesso é individual",
                d: "Convite por e-mail, com registro de quem entrou e do que alterou.",
              },
              {
                t: "Histórico de alterações",
                d: "Edições, exclusões e aprovações ficam registradas com autor e data.",
              },
              {
                t: "Dados de cada OSC separados",
                d: "Quem atende várias organizações troca de cliente sem misturar informação.",
              },
              {
                t: "Seus arquivos disponíveis",
                d: "Todos os documentos enviados ficam guardados e podem ser baixados quando quiser.",
              },
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

      <FaqAccordion items={FAQ.map((f) => ({ q: f.q, a: f.a }))} />
    </MarketingLayout>
  );
}
