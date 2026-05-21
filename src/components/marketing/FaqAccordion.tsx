import { useState } from "react";

export type FaqItem = { q: string; a: string };

export function FaqAccordion({ items, title = "Perguntas frequentes" }: { items: FaqItem[]; title?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">FAQ</p>
        <h2 className="mt-3 text-4xl md:text-5xl font-serif text-brand-navy">{title}</h2>
      </div>
      <div className="mt-12 divide-y divide-brand-line border-y border-brand-line">
        {items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left py-5 flex items-start justify-between gap-4"
                aria-expanded={isOpen}
              >
                <span className="text-lg text-brand-navy font-medium">{it.q}</span>
                <span className="mt-1.5 text-brand-blue text-xl leading-none w-6 text-right shrink-0">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="pb-6 text-brand-muted leading-relaxed text-[15px]">
                  {it.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
