import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  FileCog,
  FolderCheck,
  CalendarDays,
  Settings,
  LogOut,
  Wallet,
  Camera,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Item = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const ITEMS: Item[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/painel", label: "Painel financeiro", icon: Wallet },
  { to: "/admin/captura", label: "Captura", icon: Camera },
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
  const { user } = useAuth();
  const nav = useNavigate();

  const sair = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    nav({ to: "/login", replace: true });
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-border">
        <Link to="/" className="block">
          <div className="font-display text-lg uppercase leading-none">SIT</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Painel Admin
          </div>
        </Link>
      </div>
      <nav className="p-3 flex flex-col gap-0.5 flex-1">
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
      <div className="p-3 border-t border-border space-y-2">
        {user?.email && (
          <div className="px-2 text-xs text-muted-foreground truncate" title={user.email}>
            {user.email}
          </div>
        )}
        <button
          onClick={sair}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}

