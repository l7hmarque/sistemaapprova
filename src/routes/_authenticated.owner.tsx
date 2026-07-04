import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { OwnerSidebar } from "@/components/owner/OwnerSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/owner")({
  component: OwnerLayout,
  head: () => ({ meta: [{ title: "Owner — Approva" }] }),
});

function OwnerLayout() {
  const { user, loading, isSuperAdmin } = useCurrentUser();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (!isSuperAdmin) nav({ to: "/_authenticated/admin", replace: true });
  }, [loading, user, isSuperAdmin, nav]);

  if (loading || !user || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <OwnerSidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
