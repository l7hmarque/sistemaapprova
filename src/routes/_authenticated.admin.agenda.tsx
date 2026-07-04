import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/admin/placeholder";
export const Route = createFileRoute("/_authenticated/admin/agenda")({
  component: () => <PlaceholderPage title="Agenda" descricao="Compromissos e prazos com notificação — Fase 4." />,
});
