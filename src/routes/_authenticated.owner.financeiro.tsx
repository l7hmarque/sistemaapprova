import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLANO_VALOR: Record<string, number> = {
  essencial: 79,
  completo: 159,
  escritorio: 299,
};

export const Route = createFileRoute("/_authenticated/owner/financeiro")({ component: FinanceiroPage });

function FinanceiroPage() {
  const { data } = useQuery({
    queryKey: ["owner-financeiro"],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, nome, plano, status, trial_ate, criado_em");
      if (error) throw error;
      return orgs;
    },
  });

  const ativos = (data ?? []).filter((o) => o.status === "ativo");
  const trial = (data ?? []).filter((o) => o.status === "trial");
  const mrr = ativos.reduce((acc, o) => acc + (PLANO_VALOR[o.plano] ?? 0), 0);
  const arr = mrr * 12;
  const proxTrials = trial
    .filter((o) => o.trial_ate)
    .sort((a, b) => +new Date(a.trial_ate!) - +new Date(b.trial_ate!));

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estimativa baseada em planos cadastrados. Cobrança ainda manual.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">MRR (projetado)</div><div className="text-3xl font-display mt-1">R$ {mrr.toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">ARR (projetado)</div><div className="text-3xl font-display mt-1">R$ {arr.toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Ativos pagantes</div><div className="text-3xl font-display mt-1">{ativos.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Trials vencendo</CardTitle>
        </CardHeader>
        <CardContent>
          {!proxTrials.length ? (
            <div className="text-sm text-muted-foreground">Nenhum trial agendado.</div>
          ) : (
            <div className="divide-y divide-border">
              {proxTrials.map((o) => {
                const dias = Math.ceil(
                  (+new Date(o.trial_ate!) - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={o.id} className="flex justify-between items-center py-3 text-sm">
                    <div>
                      <div className="font-medium">{o.nome}</div>
                      <div className="text-xs text-muted-foreground">Plano: {o.plano}</div>
                    </div>
                    <Badge variant={dias < 7 ? "destructive" : "secondary"} className="uppercase">
                      {dias < 0 ? "vencido" : `${dias}d`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Planos de referência (mensal)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {Object.entries(PLANO_VALOR).map(([nome, v]) => (
              <div key={nome} className="rounded-md border border-border p-4">
                <div className="text-xs uppercase text-muted-foreground">{nome}</div>
                <div className="text-2xl font-display mt-1">R$ {v}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Stripe será plugado depois — campo <code>stripe_customer_id</code> já existe nas organizações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
