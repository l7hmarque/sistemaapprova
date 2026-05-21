import { Link } from "@tanstack/react-router";

export type Plano = {
  id: "essencial" | "profissional" | "escritorio";
  nome: string;
  preco: string;
  publico: string;
  destaque?: boolean;
  resumo: string;
  itens: string[];
  cta: string;
};

export const PLANOS: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    preco: "R$ 497",
    publico: "OSC pequena · 1 entidade",
    resumo: "Para começar a organizar a prestação de contas com tranquilidade.",
    itens: [
      "Até 100 lançamentos/mês",
      "2 usuários",
      "Exportação SIT (TCE-PR)",
      "Prestação mensal consolidada",
      "Suporte por email",
    ],
    cta: "Quero conhecer",
  },
  {
    id: "profissional",
    nome: "Profissional",
    preco: "R$ 897",
    publico: "OSC média ou contador atendendo 1 cliente",
    destaque: true,
    resumo: "O equilíbrio entre estrutura e crescimento. O mais escolhido.",
    itens: [
      "Até 500 lançamentos/mês",
      "5 usuários",
      "Agenda fiscal + alertas",
      "Modelos personalizados de orçamento",
      "Cadastro ilimitado de fornecedores",
      "Suporte prioritário (até 4h úteis)",
    ],
    cta: "Solicitar demonstração",
  },
  {
    id: "escritorio",
    nome: "Escritório",
    preco: "R$ 1.497",
    publico: "Escritório contábil · até 5 OSCs",
    resumo: "Multi-OSC, equipe e visão consolidada de carteira.",
    itens: [
      "Lançamentos ilimitados",
      "15 usuários",
      "Multi-OSC (carteira até 5 entidades)",
      "Painel consolidado por cliente",
      "Logo do escritório nos relatórios",
      "Gestor de conta dedicado",
    ],
    cta: "Falar com a equipe",
  },
];

export function PlanCards({ publico }: { publico?: "contador" | "gestor" }) {
  return (
    <section id="planos" className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
          Planos
        </p>
        <h2 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy">
          Escolha o tamanho certo
        </h2>
        <p className="mt-4 text-brand-muted text-lg">
          Todos os planos incluem <strong className="text-brand-navy">30 dias de demonstração gratuita</strong>,
          sem cartão de crédito e sem fidelidade.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANOS.map((p) => (
          <div
            key={p.id}
            className={
              p.destaque
                ? "relative rounded-2xl bg-brand-navy text-white p-8 shadow-2xl ring-1 ring-brand-navy md:-translate-y-3"
                : "relative rounded-2xl bg-white border border-brand-line p-8"
            }
          >
            {p.destaque && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-accent text-brand-navy text-[10px] font-semibold uppercase tracking-widest px-3 py-1">
                Mais escolhido
              </div>
            )}
            <div className={p.destaque ? "text-white/70 text-xs uppercase tracking-widest" : "text-brand-blue text-xs uppercase tracking-widest"}>
              {p.publico}
            </div>
            <h3 className={p.destaque ? "mt-2 text-3xl font-serif text-white" : "mt-2 text-3xl font-serif text-brand-navy"}>
              {p.nome}
            </h3>
            <div className="mt-6 flex items-baseline gap-1">
              <span className={p.destaque ? "text-5xl font-serif text-white" : "text-5xl font-serif text-brand-navy"}>
                {p.preco}
              </span>
              <span className={p.destaque ? "text-white/70 text-sm" : "text-brand-muted text-sm"}>
                /mês
              </span>
            </div>
            <p className={p.destaque ? "mt-3 text-white/80 text-sm leading-relaxed" : "mt-3 text-brand-muted text-sm leading-relaxed"}>
              {p.resumo}
            </p>

            <ul className="mt-6 space-y-2.5 text-sm">
              {p.itens.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckIcon highlight={p.destaque} />
                  <span className={p.destaque ? "text-white/95" : "text-brand-navy/85"}>{i}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/demonstracao"
              search={{ plano: p.id, publico }}
              className={
                p.destaque
                  ? "mt-8 block text-center rounded-md bg-brand-accent text-brand-navy font-medium px-5 py-3 hover:bg-brand-cream transition-colors"
                  : "mt-8 block text-center rounded-md bg-brand-navy text-white font-medium px-5 py-3 hover:bg-brand-navy-soft transition-colors"
              }
              data-track-cta={`plano-${p.id}`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-brand-muted">
        Precisa de mais que 5 OSCs ou de integração customizada?{" "}
        <Link to="/demonstracao" className="text-brand-blue underline decoration-brand-line underline-offset-4">
          Fale com a equipe
        </Link>
        .
      </p>
    </section>
  );
}

function CheckIcon({ highlight }: { highlight?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
      <path
        d="M5 12.5l4 4 10-10"
        stroke={highlight ? "#c9a84c" : "#3b6fa0"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
