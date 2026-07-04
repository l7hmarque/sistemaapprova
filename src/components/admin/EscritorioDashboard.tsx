import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/use-active-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Building2, FileText, AlertCircle, CalendarClock, ArrowRight } from "lucide-react";

type OscRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  status: string;
  trial_ate: string | null;
};

type EventoFin = { organization_id: string; status_documental: string; data_vencimento: string | null; mes_referencia: string };

export function EscritorioDashboard({ escritorioOrgId }: { escritorioOrgId: string }) {
  const { setActiveOrgId } = useActiveOrg();

  const oscsQ = useQuery({
    queryKey: ["escritorio-oscs", escritorioOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, cnpj, status, trial_ate")
        .eq("parent_organization_id", escritorioOrgId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as OscRow[];
    },
  });

  const oscIds = (oscsQ.data ?? []).map((o) => o.id);

  const eventosQ = useQuery({
    queryKey: ["escritorio-eventos", oscIds.join(",")],
    enabled: oscIds.length > 0,
    queryFn: async () => {
      const now = new Date();
      const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("eventos_financeiros")
        .select("organization_id, status_documental, data_vencimento, mes_referencia")
        .in("organization_id", oscIds)
        .eq("mes_referencia", mes);
      if (error) throw error;
      return (data ?? []) as EventoFin[];
    },
  });

  const eventosByOrg = new Map<string, EventoFin[]>();
  (eventosQ.data ?? []).forEach((e) => {
    const arr = eventosByOrg.get(e.organization_id) ?? [];
    arr.push(e);
    eventosByOrg.set(e.organization_id, arr);
  });

  const totals = (eventosQ.data ?? []).reduce(
    (acc, e) => {
      acc.total++;
      if (e.status_documental === "pendente") acc.pendentes++;
      else if (e.status_documental === "completo") acc.completos++;
      return acc;
    },
    { total: 0, pendentes: 0, completos: 0 },
  );

  return (
    <div className="p-6 md:p-8 space-y-6 md:space-y-8" data-module="dashboard">
      <header className="border-l-4 pl-4" style={{ borderColor: "var(--module-accent)" }}>
        <h1 className="text-2xl md:text-3xl font-display uppercase tracking-tight">Painel do escritório</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe suas OSCs em um só lugar. Clique em uma para entrar no contexto dela.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI icon={<Building2 className="h-5 w-5" />} label="OSCs ativas" value={oscsQ.data?.length ?? 0} />
        <KPI icon={<FileText className="h-5 w-5" />} label="Lançamentos do mês" value={totals.total} />
        <KPI
          icon={<AlertCircle className="h-5 w-5" />}
          label="Documentos pendentes"
          value={totals.pendentes}
          kind={totals.pendentes > 0 ? "warning" : "success"}
        />
      </div>

      <section>
        <h2 className="text-sm font-display uppercase tracking-widest text-muted-foreground mb-3">Suas OSCs</h2>
        {oscsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!oscsQ.isLoading && (oscsQ.data?.length ?? 0) === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhuma OSC vinculada a este escritório ainda.
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(oscsQ.data ?? []).map((osc) => {
            const eventos = eventosByOrg.get(osc.id) ?? [];
            const pendentes = eventos.filter((e) => e.status_documental === "pendente").length;
            const total = eventos.length;
            const pct = total > 0 ? Math.round(((total - pendentes) / total) * 100) : 0;
            return (
              <Card key={osc.id} className="hover:border-[var(--module-accent)] transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{osc.nome}</span>
                    <StatusBadge kind={osc.status === "ativo" ? "success" : osc.status === "trial" ? "info" : "warning"}>
                      {osc.status}
                    </StatusBadge>
                  </CardTitle>
                  {osc.cnpj && <p className="text-xs text-muted-foreground">{osc.cnpj}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Prestação do mês</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "var(--success)" : "var(--module-accent)",
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> {total} lançamentos
                    </span>
                    {pendentes > 0 && (
                      <span className="inline-flex items-center gap-1 text-[var(--warning)]">
                        <CalendarClock className="h-3.5 w-3.5" /> {pendentes} pendentes
                      </span>
                    )}
                  </div>
                  <Link
                    to="/_authenticated/admin"
                    onClick={() => setActiveOrgId(osc.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[var(--module-accent)] hover:underline"
                  >
                    Abrir OSC <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  kind = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  kind?: "neutral" | "success" | "warning";
}) {
  const color =
    kind === "success" ? "var(--success)" : kind === "warning" ? "var(--warning)" : "var(--module-accent)";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div style={{ color }}>{icon}</div>
        </div>
        <div className="font-display text-3xl md:text-4xl mt-3" style={{ color }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
