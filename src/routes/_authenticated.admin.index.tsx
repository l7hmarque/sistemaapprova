import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Tag, Paperclip, CalendarClock, FileCheck2, ArrowRight, Landmark,
} from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { EscritorioDashboard } from "@/components/admin/EscritorioDashboard";
import { resumoDashboard } from "@/lib/aprovacoes.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  const { activeOrg } = useActiveOrg();
  if (activeOrg?.tipo === "escritorio") {
    return <EscritorioDashboard escritorioOrgId={activeOrg.id} />;
  }
  return <Dashboard />;
}

function Dashboard() {
  const { activeOrgId, activeOrg } = useActiveOrg();
  const fn = useServerFn(resumoDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-resumo", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fn({ data: { organization_id: activeOrgId! } }),
  });

  return (
    <div className="p-8 space-y-8">
      <header>
        <h1 className="font-display text-3xl uppercase">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeOrg?.nome ? `${activeOrg.nome} — ` : ""}pendências e próximos passos do mês {data?.mesAtual ?? ""}.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ActionCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="A aprovar"
              value={data.pendentesRevisao}
              hint="Eventos em rascunho ou pendentes"
              to="/admin/aprovacoes"
              cta="Revisar"
              tone={data.pendentesRevisao > 0 ? "warn" : "ok"}
            />
            <ActionCard
              icon={<Tag className="h-5 w-5" />}
              label="Sem natureza REO"
              value={data.semNatureza}
              hint="Eventos aprovados sem código 3.3.90.*"
              to="/admin/painel"
              cta="Classificar"
              tone={data.semNatureza > 0 ? "warn" : "ok"}
            />
            <ActionCard
              icon={<Paperclip className="h-5 w-5" />}
              label="Sem comprovante"
              value={data.pagosSemComprovante}
              hint="Eventos pagos sem anexo"
              to="/admin/captura"
              cta="Anexar"
              tone={data.pagosSemComprovante > 0 ? "warn" : "ok"}
            />
            <ActionCard
              icon={<CalendarClock className="h-5 w-5" />}
              label="Docs vencendo (30d)"
              value={data.docsVencendo.length}
              hint="Certidões e comprovantes de vigência"
              to="/admin/prestacao"
              cta="Ver"
              tone={data.docsVencendo.length > 0 ? "warn" : "ok"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> Fechar mês {data.mesAnterior}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.snapshotMesAnterior ? (
                  <p className="text-sm text-muted-foreground">
                    Mês já homologado. Baixe o relatório na aba de snapshots.
                  </p>
                ) : data.podeFecharMesAnterior ? (
                  <>
                    <p className="text-sm">Todos os eventos do mês anterior estão aprovados — pronto para homologar.</p>
                    <Button asChild size="sm">
                      <Link to="/admin/prestacao">Gerar snapshot <ArrowRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data.pendenciasMesAnterior} evento(s) do mês anterior ainda pendente(s) de aprovação.{" "}
                    <Link to="/admin/aprovacoes" className="underline">Ver aprovações</Link>.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" /> Últimos relatórios
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.snapshots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum snapshot ainda.</p>
                ) : (
                  <ul className="divide-y">
                    {data.snapshots.map((s: any) => (
                      <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{s.titulo ?? s.mes_referencia}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.mes_referencia} · {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/admin/prestacao">Abrir</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {data.docsVencendo.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide">Documentos vencendo em 30 dias</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.docsVencendo.map((d: any) => (
                    <li key={d.id} className="py-2 flex items-center justify-between text-sm">
                      <span>{d.nome}</span>
                      <Badge variant="secondary">Válido até {d.valido_ate ?? d.data_vencimento}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ActionCard({
  icon, label, value, hint, to, cta, tone,
}: {
  icon: React.ReactNode; label: string; value: number; hint: string;
  to: string; cta: string; tone: "ok" | "warn";
}) {
  return (
    <Card className={tone === "warn" && value > 0 ? "border-orange-300" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="font-display text-4xl mt-3">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        <Button asChild size="sm" variant="ghost" className="mt-3 -ml-2 h-8 gap-1">
          <Link to={to as any}>{cta} <ArrowRight className="h-3 w-3" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
