import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/clientes/$id")({ component: ClienteDetalhe });

function ClienteDetalhe() {
  const { id } = Route.useParams();

  const { data } = useQuery({
    queryKey: ["owner-org", id],
    queryFn: async () => {
      const [org, members, cot, eventos, presta] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", id).single(),
        supabase.from("organization_members").select("user_id, role, criado_em").eq("organization_id", id),
        supabase.from("cotacoes").select("id", { count: "exact", head: true }).eq("organization_id", id),
        supabase.from("eventos_financeiros").select("id", { count: "exact", head: true }).eq("organization_id", id),
        supabase.from("prestacoes_snapshot").select("id", { count: "exact", head: true }).eq("organization_id", id),
      ]);
      return {
        org: org.data,
        membros: members.data ?? [],
        cotacoes: cot.count ?? 0,
        eventos: eventos.count ?? 0,
        prestacoes: presta.count ?? 0,
      };
    },
  });

  if (!data?.org) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <Link to="/owner/clientes" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>

      <header>
        <h1 className="font-display text-3xl uppercase">{data.org.nome}</h1>
        <div className="flex gap-2 mt-2">
          <Badge variant="secondary" className="uppercase">{data.org.tipo}</Badge>
          <Badge variant="secondary" className="uppercase">{data.org.plano}</Badge>
          <Badge variant={data.org.status === "ativo" ? "default" : "secondary"} className="uppercase">
            {data.org.status}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Cotações</div><div className="text-3xl font-display mt-1">{data.cotacoes}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Eventos financeiros</div><div className="text-3xl font-display mt-1">{data.eventos}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Prestações</div><div className="text-3xl font-display mt-1">{data.prestacoes}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Membros ({data.membros.length})</CardTitle></CardHeader>
        <CardContent>
          {!data.membros.length ? (
            <div className="text-sm text-muted-foreground">Sem membros ainda.</div>
          ) : (
            <div className="divide-y divide-border">
              {data.membros.map((m) => (
                <div key={m.user_id} className="flex justify-between py-2 text-sm">
                  <span className="font-mono">{m.user_id.slice(0, 8)}…</span>
                  <Badge variant="secondary" className="uppercase text-[10px]">{m.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Detalhes</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">CNPJ</span><span>{data.org.cnpj || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Criada em</span><span>{new Date(data.org.criado_em).toLocaleDateString("pt-BR")}</span></div>
          {data.org.trial_ate && (
            <div className="flex justify-between"><span className="text-muted-foreground">Trial até</span><span>{new Date(data.org.trial_ate).toLocaleDateString("pt-BR")}</span></div>
          )}
          <div className="flex justify-between"><span className="text-muted-foreground">Cobrança</span><span>{data.org.cobranca_externa ? "Externa (manual)" : "Stripe"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
