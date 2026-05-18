import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/admin/configuracoes")({
  component: () => <PlaceholderPage title="Configurações" descricao="Modelos de planilha, template de prestação e destinatários de alertas — fases seguintes." />,
});
