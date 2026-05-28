import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTour } from "@/components/tour/AdminTour";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2, Menu, X, Eye } from "lucide-react";
import { ViewAsProvider, useViewAs } from "@/hooks/use-view-as";
import { ActiveOrgProvider, useActiveOrg } from "@/hooks/use-active-org";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutWrapper,
  head: () => ({
    meta: [
      { title: "Painel Admin — Approva" },
      { name: "description", content: "Gestão administrativa Approva." },
    ],
  }),
});

function AdminLayoutWrapper() {
  return (
    <ViewAsProvider>
      <ActiveOrgProvider>
        <AdminLayout />
      </ActiveOrgProvider>
    </ViewAsProvider>
  );
}

function AdminLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isOverriding, role, tipo } = useViewAs();
  const { activeOrg } = useActiveOrg();
  const { isSuperAdmin } = useCurrentUser();

  useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/login", search: { redirect: window.location.pathname }, replace: true });
    }
  }, [loading, user, nav]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>

      {/* Sidebar mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted"
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <OrgSwitcher />
          {isOverriding && isSuperAdmin && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Visualizando como
              {role !== "real" && <strong className="font-semibold">{role}</strong>}
              {tipo !== "real" && <strong className="font-semibold">{tipo}</strong>}
            </div>
          )}
          {activeOrg && (
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block truncate">
              {activeOrg.tipo === "escritorio" ? "Escritório" : "OSC"} · {activeOrg.nome}
            </div>
          )}
        </header>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
        <AdminTour />
        <Toaster richColors position="top-right" />
      </main>
    </div>
  );
}
