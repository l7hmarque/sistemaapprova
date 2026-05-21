import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Painel Admin — SIT" },
      { name: "description", content: "Gestão administrativa SIT." },
    ],
  }),
});

function AdminLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

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
      <AdminSidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
