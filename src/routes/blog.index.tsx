import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

const URL = "https://sistemaapprova.lovable.app/blog";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog Approva — Prestação de contas, SCFV e Terceiro Setor" },
      {
        name: "description",
        content:
          "Conteúdo prático para gestores de OSC e contadores do terceiro setor: SCFV, IN 201/2026 TCE-PR, conciliação bancária, editais e captação.",
      },
      { property: "og:title", content: "Blog Approva" },
      {
        property: "og:description",
        content: "Conteúdo prático para gestores de OSC e contadores do terceiro setor.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: BlogIndex,
});

const POSTS = [
  {
    slug: "painel-scfv-tcepr",
    titulo: "Domingo à noite, planilha aberta, café frio",
    subtitulo:
      "A rotina invisível de quem presta contas de SCFV no Paraná — e uma planilha gratuita pronta no leiaute IN 201/2026.",
    data: "27 de maio de 2026",
    tag: "Prestação de contas · SCFV",
  },
];

function BlogIndex() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-4xl px-6 py-20">
        <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">Blog</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy">
          Notas de quem está no chão da prestação de contas
        </h1>
        <p className="mt-4 text-brand-muted text-lg max-w-2xl">
          Textos curtos, sem jargão e com material gratuito de verdade para gestores de OSC,
          contadores do terceiro setor e equipes técnicas de CAIA, CRAS e CREAS.
        </p>

        <div className="mt-12 space-y-6">
          {POSTS.map((p) => (
            <a
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block rounded-2xl border border-brand-line bg-white p-8 hover:shadow-md transition-shadow"
            >
              <p className="text-xs uppercase tracking-widest text-brand-blue">{p.tag}</p>
              <h2 className="mt-2 text-2xl font-serif text-brand-navy">{p.titulo}</h2>
              <p className="mt-2 text-brand-muted">{p.subtitulo}</p>
              <p className="mt-4 text-xs text-brand-muted">{p.data}</p>
            </a>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
