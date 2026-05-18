import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  FileCog,
  FolderCheck,
  CalendarDays,
  Settings,
} from "lucide-react";

type Item = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const ITEMS: Item[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/admin/fornecedores", label: "Fornecedores", icon: Users },
  { to: "/admin/objetos", label: "Objetos", icon: Package },
  { to: "/admin/modelos", label: "Modelos", icon: FileCog },
  { to: "/admin/prestacao", label: "Prestação", icon: FolderCheck },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground min-h-screen">
      <div className="px-5 py-6 border-b border-border">
        <Link to="/" className="block">
          <div className="font-display text-lg uppercase leading-none">SIT</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Painel Admin
          </div>
        </Link>
      </div>
      <nav className="p-3 flex flex-col gap-0.5">
        {ITEMS.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to as any}
              className={[
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-150",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
