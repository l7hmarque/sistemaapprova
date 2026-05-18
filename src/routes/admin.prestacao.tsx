import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/admin/prestacao")({
  component: () => <PlaceholderPage title="Prestação de Contas" descricao="Repositório de documentos + geração do Doc consolidado — Fase 3." />,
});
