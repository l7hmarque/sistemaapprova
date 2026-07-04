import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: ConfigLayout,
});

const TABS = [
  { to: "/admin/configuracoes", label: "Geral", exact: true },
  { to: "/admin/configuracoes/equipe", label: "Equipe", exact: false },
  { to: "/admin/configuracoes/organizacao", label: "Organização", exact: false },
];

function ConfigLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajustes da organização, equipe e integrações.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to as any}
              className={[
                "px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
