import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-line bg-brand-cream-soft mt-24">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-2xl font-serif text-brand-navy">SynSIT</div>
          <p className="mt-3 text-sm text-brand-muted max-w-sm leading-relaxed">
            Plataforma de gestão financeira e prestação de contas para organizações da
            sociedade civil e escritórios de contabilidade do terceiro setor.
          </p>
          <p className="mt-6 text-xs text-brand-muted">
            3RD TECH · Medianeira — Paraná · Brasil
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-navy font-medium">
            Produto
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/contadores" className="hover:text-brand-blue text-brand-navy/90">Para contadores</Link></li>
            <li><Link to="/gestores" className="hover:text-brand-blue text-brand-navy/90">Para gestores</Link></li>
            <li><a href="/#planos" className="hover:text-brand-blue text-brand-navy/90">Planos</a></li>
            <li><a href="/blog" className="hover:text-brand-blue text-brand-navy/90">Blog</a></li>
            <li><Link to="/demonstracao" className="hover:text-brand-blue text-brand-navy/90">Solicitar demo</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-navy font-medium">
            Empresa
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/termos" className="hover:text-brand-blue text-brand-navy/90">Termos de Uso</Link></li>
            <li><Link to="/privacidade" className="hover:text-brand-blue text-brand-navy/90">Privacidade</Link></li>
            <li><Link to="/demonstracao" className="hover:text-brand-blue text-brand-navy/90">Fale conosco</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-line">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-brand-muted flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} 3RD TECH · SynSIT</span>
          <span>CNPJ sob consulta · contato via formulário</span>
        </div>
      </div>
    </footer>
  );
}
