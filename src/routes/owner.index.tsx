import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/owner/")({ component: OwnerDashboard });

function OwnerDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["owner-stats"],
    queryFn: async () => {
      const [orgs, leads, tickets] = await Promise.all([
        supabase.from("organizations").select("status, plano"),
        supabase.from("leads").select("id, created_at, status"),
        supabase.from("support_tickets").select("id, status"),
      ]);
      const o = orgs.data ?? [];
      return {
        totalOrgs: o.length,
        ativos: o.filter((x) => x.status === "ativo").length,
        trial: o.filter((x) => x.status === "trial").length,
        suspensos: o.filter((x) => x.status === "suspenso").length,
        leadsNovos: (leads.data ?? []).filter((l) => l.status === "novo").length,
        ticketsAbertos: (tickets.data ?? []).filter((t) => t.status === "aberto").length,
      };
    },
  });

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Visão geral</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pulsação da operação Approva.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Organizações" value={stats?.totalOrgs} />
        <Stat label="Ativas" value={stats?.ativos} accent />
        <Stat label="Em trial" value={stats?.trial} />
        <Stat label="Suspensas" value={stats?.suspensos} />
        <Stat label="Leads novos" value={stats?.leadsNovos} />
        <Stat label="Tickets abertos" value={stats?.ticketsAbertos} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Modelo escritório-contábil — métricas de referência</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            Quando um escritório contábil onboarda N OSCs, métricas-alvo:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>ARPA escritório</strong>: R$ 79–199/OSC ativa (volume).</li>
            <li><strong>LTV/CAC</strong> mínimo 4×; LTV ≈ 36 meses × ARPA × % retenção.</li>
            <li><strong>Churn mensal</strong> alvo ≤ 2,5% (terceiro setor é fiel quando o produto resolve compliance).</li>
            <li><strong>NPS</strong> alvo ≥ 50 entre coordenadores e contadores.</li>
            <li><strong>Time-to-first-SIT</strong>: ≤ 48h desde criação da org.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value?: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={["text-3xl font-display mt-1", accent ? "text-primary" : "text-foreground"].join(" ")}>
          {value ?? "—"}
        </div>
      </CardContent>
    </Card>
  );
}
