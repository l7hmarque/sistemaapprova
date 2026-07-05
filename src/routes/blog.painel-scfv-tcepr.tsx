import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { capturarLeadBlog } from "@/lib/blog-leads.functions";

const SLUG = "painel-scfv-tcepr";
const TITLE = "Domingo à noite, planilha aberta, café frio: a rotina de quem presta contas de SCFV";
const DESCRIPTION = "Por que a prestação de contas SCFV consome seus domingos — e uma planilha gratuita pronta no leiaute IN 201/2026 do TCE-PR para você usar hoje à noite.";
const URL = "https://sistemaapprova.lovable.app/blog/painel-scfv-tcepr";
const PUBLISHED = "2026-05-27";

export const Route = createFileRoute("/blog/painel-scfv-tcepr")({
  head: () => ({
    meta: [
      { title: `${TITLE} — Approva` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "article:published_time", content: PUBLISHED },
      { property: "article:author", content: "Approva" },
      { property: "article:section", content: "Terceiro Setor" },
      { property: "article:tag", content: "SCFV, TCE-PR, Prestação de Contas, OSC, IN 201/2026" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: TITLE,
          description: DESCRIPTION,
          datePublished: PUBLISHED,
          dateModified: PUBLISHED,
          author: { "@type": "Organization", name: "Approva" },
          publisher: {
            "@type": "Organization",
            name: "Approva",
            url: "https://sistemaapprova.lovable.app",
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": URL },
          keywords: "SCFV, TCE-PR, IN 201/2026, prestação de contas, OSC, terceiro setor, Medianeira",
        }),
      },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/blog" className="text-sm text-brand-blue hover:underline">
          ← Blog
        </Link>
        <header className="mt-6 border-b border-brand-line pb-8">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
            Prestação de contas · SCFV · TCE-PR
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy leading-tight">
            Domingo à noite, planilha aberta, café frio
          </h1>
          <p className="mt-4 text-lg text-brand-muted">
            A rotina invisível de quem presta contas de SCFV no Paraná — e uma
            planilha gratuita pronta no leiaute IN 201/2026 do TCE-PR.
          </p>
          <p className="mt-6 text-xs text-brand-muted">
            Publicado em 27 de maio de 2026 · 6 min de leitura
          </p>
        </header>

        <div className="prose-content mt-10 space-y-6 text-brand-navy/90 leading-relaxed">
          <blockquote className="border-l-4 border-brand-accent bg-brand-cream-soft px-5 py-4 rounded-r-md">
            <p className="text-sm">
              <strong>Material gratuito ao final do post:</strong> Painel de Controle SCFV —
              IN 201/2026 TCE-PR (planilha Excel pronta, com fórmulas, conciliação automática,
              consolidado bimestral e checklist de transmissão).
            </p>
          </blockquote>

          <h2 className="text-2xl font-serif text-brand-navy mt-12">A cena</h2>
          <p>
            São 22h47 de um domingo. A gestora da OSC está na quarta xícara de café, com o extrato
            do Banco do Brasil aberto numa aba, o plano de aplicação noutra, uma pasta cheia de
            PDFs de NF na terceira, e a planilha{" "}
            <em>"Prestação 2026 — FINAL_v8_REVISADO.xlsx"</em> no centro da tela.
          </p>
          <p>Amanhã o contador precisa do bimestre fechado. E ela já sabe o que vai acontecer:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Vão faltar 3 notas que o oficineiro mandou no WhatsApp e nunca foram pra pasta certa.</li>
            <li>Vai aparecer um débito de R$ 312,40 no extrato que ninguém sabe o que é.</li>
            <li>Vai dar diferença de R$ 0,17 entre a planilha e o banco — porque alguém digitou um valor com vírgula trocada três meses atrás.</li>
            <li>E quando o arquivo .txt for gerado, o validador do TCE vai cuspir um erro de leiaute na linha 47.</li>
          </ul>
          <p>
            Isso não é desorganização. <strong>É o jeito como o sistema foi montado pra funcionar.</strong>
          </p>

          <h2 className="text-2xl font-serif text-brand-navy mt-12">
            A dor real (que ninguém fala em voz alta)
          </h2>
          <p>
            Quem trabalha com SCFV — Serviço de Convivência e Fortalecimento de Vínculos,
            financiado via Termo de Colaboração com o município — convive com três coisas que
            consomem mais energia do que o atendimento aos usuários:
          </p>
          <p>
            <strong>1. A prestação de contas é um Frankenstein.</strong> Você precisa juntar plano
            de trabalho, plano de aplicação, lançamentos por rubrica, conciliação bancária, folha
            de pagamento com encargos, contratos de terceiros, cotações, listas de presença, atas
            do conselho, e ainda gerar um arquivo <code>.txt</code> no leiaute específico da{" "}
            <a
              href="https://www.tce.pr.gov.br/"
              target="_blank"
              rel="noopener"
              className="text-brand-blue underline decoration-brand-line underline-offset-4"
            >
              IN 201/2026 do TCE-PR
            </a>{" "}
            — que entrou em vigor agora e mudou a periodicidade pra <strong>bimestral</strong>.
          </p>
          <p>
            <strong>2. Um erro de R$ 0,01 trava tudo.</strong> O SIT (Sistema Integrado de
            Transferências) não perdoa. Diferença de centavo entre extrato e planilha? Rejeitado.
            CNPJ com dígito verificador errado? Rejeitado. Rubrica que não existe no plano
            aprovado? Rejeitado. E você descobre isso <em>depois</em> de transmitir.
          </p>
          <p>
            <strong>3. A glosa é silenciosa e cara.</strong> O TCE não te liga. Ele lança no
            relatório anual e, dois anos depois, a OSC recebe uma notificação pra devolver R$ 47
            mil ao fundo — com correção. Porque três notas em 2024 estavam com a rubrica errada e
            ninguém percebeu.
          </p>

          <h2 className="text-2xl font-serif text-brand-navy mt-12">
            E os editais não esperam você se organizar
          </h2>
          <p>
            Olhando o portal de parcerias da Prefeitura de <strong>Medianeira-PR</strong> esta
            semana, tem dois editais novíssimos abertos pelo CMDCA e CMDPI (Chamamentos 001/2026 e
            002/2026, publicados em 19/05/2026) para banco de projetos e captação via FIA/FMDPI.
            Não é SCFV direto, mas é a porta de entrada das OSCs no orçamento municipal.
          </p>
          <p>
            Em municípios vizinhos como <strong>São Mateus do Sul-PR</strong>, o chamamento
            público específico de SCFV para 2026 já saiu em 30/09/2025. É questão de tempo até
            Medianeira repetir o ciclo.
          </p>
          <p>
            E aí vem a pergunta desconfortável:{" "}
            <strong>
              se o edital sair em 60 dias, sua OSC consegue mostrar uma prestação de contas dos
              últimos 6 bimestres limpa, conciliada, sem glosas e pronta pra anexar ao plano de
              trabalho?
            </strong>
          </p>
          <p>Se a resposta envolveu uma pausa, este material é pra você.</p>

          <h2 className="text-2xl font-serif text-brand-navy mt-12">
            O que esse material faz por você (e por que vale mais que um e-book)
          </h2>
          <p>E-book ensina. Planilha executa.</p>
          <p>
            Em vez de mais 40 páginas de PDF te explicando o que você já sabe que precisa fazer,
            montamos o <strong>Painel de Controle SCFV — IN 201/2026 TCE-PR</strong>: um arquivo
            Excel pronto, com 9 abas conectadas por fórmulas, que faz o trabalho braçal por você:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Parâmetros</strong> — você preenche CNPJ, termo, valor e conta uma vez.</li>
            <li><strong>Plano de Aplicação</strong> — rubricas com saldo e % de execução calculados automaticamente.</li>
            <li><strong>Lançamentos</strong> — registra despesa por despesa, com validação de rubrica em tempo real (verde se existe no plano, vermelho se não).</li>
            <li><strong>Conciliação Bancária</strong> — você cola o extrato, a planilha cruza com os lançamentos pela data + valor e marca ✓ ou ⚠.</li>
            <li><strong>Bimestre</strong> — escolhe "B3/2026" e ela consolida o que vai pro SIT.</li>
            <li><strong>Checklist 15 itens</strong> — os mesmos pontos que o TCE checa nas auditorias de OSC.</li>
            <li><strong>Alertas</strong> — fórmulas que apontam execução acima do repasse, rubrica inválida e saldo a executar.</li>
          </ul>
          <p>
            É a mesma lógica que está dentro do Approva, mas numa planilha simples que você abre no
            Excel ou no Google Sheets e usa hoje à noite.
          </p>
        </div>

        <DownloadForm />

        <div className="mt-16 border-t border-brand-line pt-8 space-y-4">
          <h2 className="text-2xl font-serif text-brand-navy">
            E depois, se você quiser parar de fazer na mão
          </h2>
          <p className="text-brand-navy/90 leading-relaxed">
            A planilha resolve hoje. Mas se sua OSC ou seu escritório atende mais de uma entidade,
            ou se você simplesmente não quer mais perder domingo de noite, é pra isso que o Approva
            existe:
          </p>
          <ul className="list-disc pl-6 text-brand-navy/90 space-y-1">
            <li>Lê os PDFs de NF, boleto, holerite e extrai os dados pra você.</li>
            <li>Concilia o extrato bancário sozinho.</li>
            <li>Monta o <code>.txt</code> no leiaute exato do SIT TCE-PR.</li>
            <li>Mantém histórico auditável de tudo, com 1 clique.</li>
          </ul>
          <Link
            to="/demonstracao"
            className="mt-4 inline-flex items-center rounded-md bg-brand-navy text-white px-5 py-3 text-sm font-medium hover:bg-brand-navy-soft transition-colors"
            data-track-cta="blog-painel-scfv-demo"
          >
            Solicitar demonstração gratuita (30 dias)
          </Link>
        </div>
      </article>
    </MarketingLayout>
  );
}

function DownloadForm() {
  const capturar = useServerFn(capturarLeadBlog);
  const [email, setEmail] = useState("");
  const [osc, setOsc] = useState("");
  const [hp, setHp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await capturar({
        data: {
          email,
          osc_nome: osc,
          origem: "blog-painel-scfv",
          download_slug: SLUG,
          hp,
        },
      });
      setUrl(r.downloadUrl ?? "/downloads/painel-scfv-tcepr.xlsx");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao registrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section
      id="baixar"
      className="mt-16 rounded-2xl border border-brand-line bg-brand-cream-soft p-8"
    >
      <h2 className="text-2xl font-serif text-brand-navy">Baixar a planilha</h2>
      <p className="mt-2 text-sm text-brand-muted">
        Sem cartão, sem cadastro complicado. Só pra a gente saber pra quem está sendo útil.
      </p>

      {url ? (
        <div className="mt-6 rounded-md bg-white border border-brand-line p-6 text-center">
          <p className="text-brand-navy font-medium">Tudo certo, {osc || "OSC"}!</p>
          <p className="mt-1 text-sm text-brand-muted">
            Clique no botão abaixo. O arquivo abre direto no Excel ou Google Sheets.
          </p>
          <a
            href={url}
            download
            className="mt-5 inline-flex items-center rounded-md bg-brand-navy text-white px-6 py-3 text-sm font-medium hover:bg-brand-navy-soft transition-colors"
            data-track-cta="blog-painel-scfv-download"
          >
            ↓ Baixar Painel SCFV (Excel)
          </a>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            type="email"
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-brand-line bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
          <input
            type="text"
            required
            minLength={2}
            placeholder="Nome da OSC ou escritório"
            value={osc}
            onChange={(e) => setOsc(e.target.value)}
            className="rounded-md border border-brand-line bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
          {/* honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            className="hidden"
            aria-hidden
          />
          <button
            type="submit"
            disabled={enviando}
            className="md:col-span-2 rounded-md bg-brand-navy text-white px-5 py-3 text-sm font-medium hover:bg-brand-navy-soft transition-colors disabled:opacity-60"
            data-track-cta="blog-painel-scfv-form"
          >
            {enviando ? "Liberando…" : "Liberar download gratuito"}
          </button>
          {erro && <p className="md:col-span-2 text-sm text-red-600">{erro}</p>}
          <p className="md:col-span-2 text-xs text-brand-muted">
            Não enviamos spam. Pode descadastrar quando quiser.
          </p>
        </form>
      )}
    </section>
  );
}
