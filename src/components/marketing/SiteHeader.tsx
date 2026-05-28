import { Link } from "@tanstack/react-router";
import { ApprovaLogo } from "@/components/brand/ApprovaLogo";

export function SiteHeader() {
  return (
    <header className="border-b border-brand-line bg-white/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-brand-navy">
          <ApprovaLogo variant="full" size="md" />
          <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-brand-muted font-sans">
            por 3RD TECH
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-brand-navy/90">
          <Link to="/contadores" className="hover:text-brand-blue transition-colors">
            Para Contadores
          </Link>
          <Link to="/gestores" className="hover:text-brand-blue transition-colors">
            Para Gestores
          </Link>
          <a href="/#planos" className="hover:text-brand-blue transition-colors">
            Planos
          </a>
          <a href="/blog" className="hover:text-brand-blue transition-colors">
            Blog
          </a>
          <Link to="/demonstracao" className="hover:text-brand-blue transition-colors">
            Contato
          </Link>
        </nav>
        <Link
          to="/demonstracao"
          className="inline-flex items-center rounded-md bg-brand-navy text-white px-4 py-2 text-sm font-medium hover:bg-brand-navy-soft transition-colors"
        >
          Demonstração grátis
        </Link>
      </div>
    </header>
  );
}
