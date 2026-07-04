import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, FolderTree, HardDrive, RefreshCw, Eye, ExternalLink, CloudUpload, AlertTriangle } from "lucide-react";
import { listarArquivosDaOrg, getDriveQuota, getDriveSyncStatus } from "@/lib/arquivos.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/_authenticated/admin/arquivos")({
  component: ArquivosPage,
});

const SECTIONS = ["Orçamentos", "Cotações", "Prestações", "Documentos"] as const;
type Section = (typeof SECTIONS)[number];

function formatBytes(n: number): string {
  if (!n) return "0";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function iconForMime(mt: string) {
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function ArquivosPage() {
  const { activeOrgId } = useActiveOrg();
  const [section, setSection] = useState<Section>("Documentos");
  const [mes, setMes] = useState<string>("");
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mimeType: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fnList = useServerFn(listarArquivosDaOrg);
  const fnQuota = useServerFn(getDriveQuota);

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

  const filtered = useMemo(() => {
    const list = filesQ.data?.files ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((f) => f.name.toLowerCase().includes(s));
  }, [filesQ.data, search]);

  useEffect(() => {
    if (!previewFile) { setPreviewUrl(null); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      setPreviewUrl(`/api/files/${previewFile.id}/preview?t=${encodeURIComponent(token)}`);
    })();
  }, [previewFile]);

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
              <Select value={section} onValueChange={(v) => setSection(v as Section)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
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
              {filtered.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                  {iconForMime(f.mimeType)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {f.mimeType.split("/").pop()?.split(".").pop() ?? "arquivo"}
                      </Badge>
                      <span>{new Date(f.modifiedTime).toLocaleString("pt-BR")}</span>
                      {f.size && <span>· {formatBytes(Number(f.size))}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewFile({ id: f.id, name: f.name, mimeType: f.mimeType })}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-8">
              <span className="truncate">{previewFile?.name}</span>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> abrir em nova aba
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted rounded">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title={previewFile?.name}
                className="w-full h-full rounded"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
