import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  listarPendentes,
  aprovarComprovante,
  linkComprovante,
} from "@/lib/comprovantes.functions";
import { useActiveOrg } from "@/hooks/use-active-org";
import { CheckCircle2, XCircle, FileText, ExternalLink, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/aprovacoes")({
  head: () => ({
    meta: [{ title: "Aprovações pendentes — Approva" }],
  }),
  component: AprovacoesPage,
});

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AprovacoesPage() {
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
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pendentes = data?.pendentes ?? [];

  return (
    <AdminShell title="Aprovações" subtitle="Comprovantes pendentes de revisão em duas mãos">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> {pendentes.length} comprovante(s) aguardando
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && pendentes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nada pendente. Bom trabalho.
              </p>
            )}
            <ul className="divide-y">
              {pendentes.map((p) => (
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        mut.mutate({ id: p.id, status: "rejeitado", observacao: obs[p.id] })
                      }
                      className="gap-1 text-destructive"
                    >
                      <XCircle className="h-3 w-3" /> Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        mut.mutate({ id: p.id, status: "aprovado", observacao: obs[p.id] })
                      }
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          A política de quatro olhos impede que o mesmo usuário que anexou um comprovante
          também o aprove.
        </p>
      </div>
    </AdminShell>
  );
}
