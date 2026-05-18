import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/ui/sonner";

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
