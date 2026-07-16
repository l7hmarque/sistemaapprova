import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  listarPendentes,
  aprovarComprovante,
  linkComprovante,
} from "@/lib/comprovantes.functions";
import {
  listarEventosPendentes,
  aprovarEventosLote,
  devolverEvento,
} from "@/lib/aprovacoes.functions";
import { useActiveOrg } from "@/hooks/use-active-org";
import {
  CheckCircle2, XCircle, FileText, ExternalLink, ShieldCheck,
  AlertTriangle, Undo2, ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações — Approva" }] }),
  component: AprovacoesPage,
});

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtBRL(n: number | null) {
  if (n == null) return "—";
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function AprovacoesPage() {
  return (
    <AdminShell title="Aprovações" subtitle="Revisão de eventos e comprovantes antes de homologar o mês">
      <Tabs defaultValue="eventos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="eventos" className="gap-1">
            <ListChecks className="h-4 w-4" /> Eventos financeiros
          </TabsTrigger>
          <TabsTrigger value="comprovantes" className="gap-1">
            <ShieldCheck className="h-4 w-4" /> Comprovantes (2 mãos)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="eventos"><EventosTab /></TabsContent>
        <TabsContent value="comprovantes"><ComprovantesTab /></TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function EventosTab() {
  const { activeOrgId, activeRole } = useActiveOrg();
  const [mes, setMes] = useState(mesAtual());
  const fetchFn = useServerFn(listarEventosPendentes);
  const aprovarFn = useServerFn(aprovarEventosLote);
  const devolverFn = useServerFn(devolverEvento);
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<"todos" | "semNat" | "semComp" | "diverg">("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["aprov-eventos", activeOrgId, mes],
    enabled: !!activeOrgId,
    queryFn: () => fetchFn({ data: { organization_id: activeOrgId!, mes_referencia: mes } }),
  });

  const eventos = useMemo(() => {
    const list = data ?? [];
    return list.filter((e: any) => {
      if (filtro === "semNat") return e.pendencias.semNatureza;
      if (filtro === "semComp") return e.pendencias.semComprovante;
      if (filtro === "diverg") return e.pendencias.divergente;
      return true;
    });
  }, [data, filtro]);

  const podeAprovar = activeRole === "owner" || activeRole === "admin";

  const aprovarSel = useMutation({
    mutationFn: () => aprovarFn({ data: { organization_id: activeOrgId!, ids: [...sel] } }),
    onSuccess: (r) => {
      toast.success(`${r.aprovados} evento(s) aprovado(s).`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["aprov-eventos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumo"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const devolverMut = useMutation({
    mutationFn: (args: { id: string; motivo: string }) =>
      devolverFn({ data: { organization_id: activeOrgId!, ...args } }),
    onSuccess: () => {
      toast.success("Evento devolvido para rascunho.");
      qc.invalidateQueries({ queryKey: ["aprov-eventos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!podeAprovar) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Somente administradores da organização podem aprovar eventos.
      </CardContent></Card>
    );
  }

  const toggle = (id: string) => {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (sel.size === eventos.length) setSel(new Set());
    else setSel(new Set(eventos.map((e: any) => e.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">Mês:</label>
        <input
          type="text" value={mes} onChange={(e) => setMes(e.target.value)}
          placeholder="AAAA-MM" className="rounded border px-2 py-1 text-sm w-28"
        />
        <div className="flex gap-1 ml-auto">
          {(["todos","semNat","semComp","diverg"] as const).map((f) => (
            <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"}
              onClick={() => setFiltro(f)}>
              {f === "todos" ? "Todos" : f === "semNat" ? "Sem natureza" : f === "semComp" ? "Sem comprovante" : "Divergentes"}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {eventos.length} evento(s) pendente(s){sel.size > 0 && ` · ${sel.size} selecionado(s)`}
          </CardTitle>
          <Button size="sm" disabled={sel.size === 0 || aprovarSel.isPending}
            onClick={() => aprovarSel.mutate()}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar seleção
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && eventos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum evento pendente neste mês. </p>
          )}
          {eventos.length > 0 && (
            <ul className="divide-y">
              <li className="py-2 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <Checkbox checked={sel.size === eventos.length} onCheckedChange={toggleAll} />
                <span>Selecionar todos</span>
              </li>
              {eventos.map((e: any) => (
                <li key={e.id} className="py-3 grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-start">
                  <Checkbox checked={sel.has(e.id)} onCheckedChange={() => toggle(e.id)} className="mt-1" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="text-xs text-muted-foreground font-mono">{e.id_interno ?? "—"}</span>
                      {e.nm_favorecido || e.descricao || <span className="text-muted-foreground">Sem descrição</span>}
                      <span className="text-xs text-muted-foreground">· {fmtBRL(e.valor_efetivo ?? e.valor_previsto)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.natureza_despesa_codigo
                        ? <Badge variant="outline" className="text-[10px]">{e.natureza_despesa_codigo}</Badge>
                        : <Badge variant="destructive" className="text-[10px]">sem natureza</Badge>}
                      {e.pendencias.semComprovante && <Badge variant="secondary" className="text-[10px]">sem comprovante</Badge>}
                      {e.pendencias.divergente && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" /> divergente
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{e.origem}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => {
                        const m = prompt("Motivo da devolução:") ?? "";
                        if (m.trim().length >= 3) devolverMut.mutate({ id: e.id, motivo: m.trim() });
                      }}>
                      <Undo2 className="h-3 w-3" /> Devolver
                    </Button>
                    <Button size="sm" className="gap-1"
                      onClick={() => aprovarFn({ data: { organization_id: activeOrgId!, ids: [e.id] } })
                        .then(() => { toast.success("Aprovado."); qc.invalidateQueries({ queryKey: ["aprov-eventos"] }); })
                        .catch((err) => toast.error((err as Error).message))}>
                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Eventos aprovados podem ser homologados via snapshot em Prestação. Rascunhos e pendentes bloqueiam a homologação.
      </p>
    </div>
  );
}

function ComprovantesTab() {
  const fetchPendentes = useServerFn(listarPendentes);
  const aprovar = useServerFn(aprovarComprovante);
  const link = useServerFn(linkComprovante);
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["aprovacoes-pendentes", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fetchPendentes({ data: { organization_id: activeOrgId! } }),
  });

  const mut = useMutation({
    mutationFn: (args: { id: string; status: "aprovado" | "rejeitado"; observacao?: string }) =>
      aprovar({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aprovacoes-pendentes"] });
      toast.success("Decisão registrada.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [obs, setObs] = useState<Record<string, string>>({});
  async function abrir(path: string | null) {
    if (!path) return;
    try {
      const { url } = await link({ data: { path } });
      window.open(url, "_blank");
    } catch (e) { toast.error((e as Error).message); }
  }

  const pendentes = data?.pendentes ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> {pendentes.length} comprovante(s) aguardando
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && pendentes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada pendente.</p>
        )}
        <ul className="divide-y">
          {pendentes.map((p: any) => (
            <li key={p.id} className="py-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {p.nome}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Extração <code>{p.extracao_id?.slice(0, 8)}</code> · Despesa{" "}
                  <code>{p.despesa_uid}</code> · {fmtBytes(p.tamanho_bytes)} ·{" "}
                  {new Date(p.criado_em).toLocaleString("pt-BR")}
                </div>
                <input
                  type="text"
                  placeholder="Observação (opcional)"
                  value={obs[p.id] ?? ""}
                  onChange={(e) => setObs((s) => ({ ...s, [p.id]: e.target.value }))}
                  className="mt-2 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button size="sm" variant="outline" onClick={() => abrir(p.arquivo_url)} className="gap-1">
                  <ExternalLink className="h-3 w-3" /> Ver
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => mut.mutate({ id: p.id, status: "rejeitado", observacao: obs[p.id] })}
                  className="gap-1 text-destructive">
                  <XCircle className="h-3 w-3" /> Rejeitar
                </Button>
                <Button size="sm"
                  onClick={() => mut.mutate({ id: p.id, status: "aprovado", observacao: obs[p.id] })}
                  className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Aprovar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
