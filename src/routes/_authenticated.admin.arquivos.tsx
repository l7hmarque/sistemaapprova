import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, FileText, FolderTree, HardDrive, RefreshCw, Download, CloudUpload, AlertTriangle } from "lucide-react";
import { listarArquivosDaOrg, getDriveQuota, getDriveSyncStatus } from "@/lib/arquivos.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/_authenticated/admin/arquivos")({
  component: ArquivosPage,
});

const SECTIONS = ["Orçamentos", "Cotações", "Prestações", "Documentos"] as const;
type Section = (typeof SECTIONS)[number];
type SectionFilter = "todas" | Section;

function formatBytes(n: number): string {
  if (!n) return "0";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function iconForMime(_mt: string) {
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function ArquivosPage() {
  const { activeOrgId } = useActiveOrg();
  const [section, setSection] = useState<SectionFilter>("todas");
  const [mes, setMes] = useState<string>("");
  const [search, setSearch] = useState("");
  const [baixando, setBaixando] = useState<string | null>(null);

  const fnList = useServerFn(listarArquivosDaOrg);
  const fnQuota = useServerFn(getDriveQuota);
  const fnSync = useServerFn(getDriveSyncStatus);

  const filesQ = useQuery({
    queryKey: ["arquivos", activeOrgId, section, mes],
    queryFn: async () =>
      fnList({ data: { section, ...(mes ? { mes } : {}) } }),
    enabled: !!activeOrgId,
  });

  const quotaQ = useQuery({
    queryKey: ["drive-quota", activeOrgId],
    queryFn: async () => fnQuota(),
    enabled: !!activeOrgId,
    staleTime: 60_000,
  });

  const syncQ = useQuery({
    queryKey: ["drive-sync", activeOrgId],
    queryFn: async () => fnSync(),
    enabled: !!activeOrgId,
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    const list = (filesQ.data?.files ?? []) as any[];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((f) => f.name.toLowerCase().includes(s));
  }, [filesQ.data, search]);

  const baixarArquivo = async (id: string, name: string) => {
    try {
      setBaixando(id);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada, faça login novamente.");
      const res = await fetch(`/api/files/${id}/preview?t=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        if (res.status === 403) {
          throw new Error("Sem permissão para baixar este arquivo (fora da sua organização).");
        }
        if (res.status === 401) throw new Error("Sessão expirada.");
        throw new Error(`Falha ao baixar (${res.status}) ${txt.slice(0, 120)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || `arquivo-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar");
    } finally {
      setBaixando(null);
    }
  };

  const quota = quotaQ.data;
  const pct = quota && quota.limit > 0 ? Math.round((quota.usage / quota.limit) * 100) : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase flex items-center gap-2">
            <FolderTree className="h-7 w-7" /> Arquivos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tudo que sua OSC gera ou anexa no Approva, organizado por seção e mês.
          </p>
        </div>
        {quota && (
          <Card className="w-full sm:w-72">
            <CardContent className="pt-4 pb-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <HardDrive className="h-3.5 w-3.5" /> Armazenamento
                </span>
                <span className={pct >= 80 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                  {formatBytes(quota.usage)} / {formatBytes(quota.limit)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={pct >= 80 ? "bg-amber-500 h-full" : "bg-primary h-full"}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              {pct >= 80 && (
                <p className="text-[11px] text-amber-700">Atenção: aproximando do limite.</p>
              )}
              {syncQ.data && (syncQ.data.pendente > 0 || syncQ.data.falhou_retry > 0 || syncQ.data.falhou_definitivo > 0) && (
                <div className="pt-2 border-t space-y-1">
                  {syncQ.data.pendente > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CloudUpload className="h-3 w-3 animate-pulse" />
                      Sincronizando {syncQ.data.pendente} arquivo(s) com Drive…
                    </div>
                  )}
                  {(syncQ.data.falhou_retry > 0 || syncQ.data.falhou_definitivo > 0) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {syncQ.data.falhou_retry + syncQ.data.falhou_definitivo} falha(s) — retry automático
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Navegador de arquivos</span>
            <Button size="sm" variant="ghost" onClick={() => filesQ.refetch()}>
              <RefreshCw className={`h-4 w-4 ${filesQ.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">Seção</label>
              <Select value={section} onValueChange={(v) => setSection(v as SectionFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as seções</SelectItem>
                  {SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mês (AAAA-MM)</label>
              <Input
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                placeholder="opcional"
                className="w-36"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="nome do arquivo…"
              />
            </div>
          </div>

          {filesQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando arquivos…
            </div>
          ) : filesQ.error ? (
            <p className="text-sm text-destructive py-8">
              Erro ao carregar: {(filesQ.error as Error).message}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum arquivo nesta pasta ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {filtered.map((f) => {
                const ext = (f.name.split(".").pop() || f.mimeType.split("/").pop() || "arquivo").toLowerCase();
                return (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                    {iconForMime(f.mimeType)}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        {f.section && (
                          <Badge variant="secondary" className="text-[10px]">{f.section}</Badge>
                        )}
                        {f.mes && (
                          <Badge variant="outline" className="text-[10px]">{f.mes}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] uppercase">{ext}</Badge>
                        {f.linkedEventoInterno && (
                          <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/10">
                            despesa #{f.linkedEventoInterno}
                          </Badge>
                        )}
                        {f.linkedPrestacao && (
                          <Badge className="text-[10px] bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10">
                            doc. cadastrado
                          </Badge>
                        )}
                        <span>·</span>
                        <span>{new Date(f.modifiedTime).toLocaleString("pt-BR")}</span>
                        {f.size && <span>· {formatBytes(Number(f.size))}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={baixando === f.id}
                      onClick={() => baixarArquivo(f.id, f.name)}
                      title="Baixar"
                    >
                      {baixando === f.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
