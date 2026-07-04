import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  LifeBuoy,
  DollarSign,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signOutLimpo } from "@/lib/auth/signOutLimpo";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const ITEMS = [
  { to: "/_authenticated/owner", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/_authenticated/owner/clientes", label: "Clientes", icon: Building2 },
  { to: "/_authenticated/owner/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/_authenticated/owner/financeiro", label: "Financeiro", icon: DollarSign },
];

export function OwnerSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const sair = async () => {
    await signOutLimpo(queryClient);
    toast.success("Sessão encerrada");
    nav({ to: "/login", replace: true });
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-border">
        <Link to="/" className="block">
          <div className="font-display text-lg uppercase leading-none">Owner</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Owner — staff
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
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}
        <Link
          to="/_authenticated/admin"
          className="mt-4 flex items-center gap-3 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Ir para /admin</span>
        </Link>
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
