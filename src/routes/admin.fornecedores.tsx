import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/admin/fornecedores")({
  component: () => <PlaceholderPage title="Fornecedores" descricao="Cadastro de fornecedores — em construção." />,
});
