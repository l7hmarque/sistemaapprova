import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/admin/orcamentos")({
  component: () => <PlaceholderPage title="Orçamentos" descricao="Gerenciamento de orçamentos salvos — em construção." />,
});
