import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/admin/modelos")({
  component: () => <PlaceholderPage title="Modelos de planilha" descricao="Cadastro de modelos de Orçamento, Mapa Comparativo e Controle Bancário — Fase 2." />,
});
