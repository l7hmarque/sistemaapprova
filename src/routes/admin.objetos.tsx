import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/admin/objetos")({
  component: () => <PlaceholderPage title="Objetos de cotação" descricao="Catálogo de objetos — em construção." />,
});
