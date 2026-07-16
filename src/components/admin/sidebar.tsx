import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  FileCog,
  FolderCheck,
  // CalendarDays,  // reintroduzir quando a Agenda voltar ao menu
  Settings,
  LogOut,
  Wallet,
  Camera,
  ShieldCheck,
  Crown,
  FolderTree,
  Landmark,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { signOutLimpo } from "@/lib/auth/signOutLimpo";
import { ApprovaLogo } from "@/components/brand/ApprovaLogo";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useViewAs } from "@/hooks/use-view-as";
import { useActiveOrg } from "@/hooks/use-active-org";
import { resumoDashboard } from "@/lib/aprovacoes.functions";
import { ViewAsSwitcher } from "./ViewAsSwitcher";
import { toast } from "sonner";

type Item = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; tour?: string; module: string };
const ITEMS: Item[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, tour: "nav-dashboard", module: "dashboard" },
  { to: "/admin/painel", label: "Painel financeiro", icon: Wallet, tour: "nav-painel", module: "painel" },
  { to: "/admin/captura", label: "Captura", icon: Camera, tour: "nav-captura", module: "captura" },
  { to: "/admin/orcamentos", label: "Orçamentos", icon: FileText, tour: "nav-orcamentos", module: "orcamentos" },
  { to: "/admin/fornecedores", label: "Fornecedores", icon: Users, tour: "nav-fornecedores", module: "fornecedores" },
  { to: "/admin/objetos", label: "Objetos", icon: Package, tour: "nav-objetos", module: "objetos" },
  { to: "/admin/modelos", label: "Modelos", icon: FileCog, tour: "nav-modelos", module: "modelos" },
  { to: "/admin/prestacao", label: "Prestação", icon: FolderCheck, tour: "nav-prestacao", module: "prestacao" },
  { to: "/admin/reo", label: "REO Mensal", icon: Landmark, tour: "nav-reo", module: "reo" },
  { to: "/admin/arquivos", label: "Arquivos", icon: FolderTree, tour: "nav-arquivos", module: "arquivos" },
  { to: "/admin/aprovacoes", label: "Aprovações", icon: ShieldCheck, tour: "nav-aprovacoes", module: "aprovacoes" },
  // Agenda: rota disponível mas escondida do menu até entrega da Fase 4.
  // { to: "/admin/agenda", label: "Agenda", icon: CalendarDays, tour: "nav-agenda", module: "agenda" },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, tour: "nav-configuracoes", module: "configuracoes" },
];


export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const { isSuperAdmin } = useCurrentUser();
  const { role: viewAsRole } = useViewAs();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrgId } = useActiveOrg();
  const resumoFn = useServerFn(resumoDashboard);
  const { data: resumo } = useQuery({
    queryKey: ["dashboard-resumo", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => resumoFn({ data: { organization_id: activeOrgId! } }),
    staleTime: 60_000,
  });
  const badges: Record<string, number> = {
    "/admin/aprovacoes": resumo?.pendentesRevisao ?? 0,
  };

  const sair = async () => {
    await signOutLimpo(queryClient);
    toast.success("Sessão encerrada");
    nav({ to: "/login", replace: true });
  };

  return (
    <aside data-tour="sidebar" className="w-60 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-border">
        <Link to="/" className="block text-foreground" onClick={onNavigate}>
          <ApprovaLogo variant="full" size="md" />
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
            Painel Admin
          </div>
        </Link>
      </div>
      <nav className="p-3 flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {ITEMS.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to as any}
              data-tour={it.tour}
              onClick={onNavigate}
              data-module={it.module}
              className={[
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-150 relative",
                active
                  ? "text-foreground bg-[var(--module-accent-soft,var(--secondary))]"
                  : "text-foreground hover:bg-muted",
              ].join(" ")}
              style={active ? { boxShadow: "inset 3px 0 0 0 var(--module-accent, var(--primary))" } : undefined}
            >
              <Icon
                className="h-4 w-4"
                style={active ? { color: "var(--module-accent, var(--primary))" } : undefined}
              />
              <span className="font-medium flex-1">{it.label}</span>
              {badges[it.to] > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-semibold h-5 min-w-5 px-1.5">
                  {badges[it.to]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div data-tour="user-area" className="p-3 border-t border-border space-y-2">
        {isSuperAdmin && <ViewAsSwitcher />}
        {isSuperAdmin && viewAsRole === "real" && (
          <Link
            to="/owner"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md bg-accent/30 text-foreground hover:bg-accent transition-colors"
          >
            <Crown className="h-4 w-4" />
            <span className="font-medium">Painel Owner</span>
          </Link>
        )}
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
