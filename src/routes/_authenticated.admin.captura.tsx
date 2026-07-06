import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Camera, Upload, Link2, Trash2, Loader2, RefreshCw } from "lucide-react";
import {
  enfileirarCaptura,
  listarCapturaJobs,
  reprocessarCapturaJob,
  removerCapturaJob,
} from "@/lib/captura-jobs.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/_authenticated/admin/captura")({ component: CapturaPage });

type Status = "pendente" | "processando" | "concluido" | "erro" | "cancelado";

type Job = {
  id: string;
  status: Status;
  mensagem: string | null;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  mes_referencia: string;
  evento_id: string | null;
  documento_id: string | null;
  dados: {
    tipo?: string | null;
    cnpj?: string | null;
    razao_social?: string | null;
    valor?: number | null;
    data_vencimento?: string | null;
    data_emissao?: string | null;
    data_pagamento?: string | null;
  } | null;
  criado_em: string;
  atualizado_em: string;
  tentativas: number;
};

type Evento = {
  id: string;
  descricao: string | null;
  categoria: string;
  valor_previsto: number | null;
  data_vencimento: string | null;
  fornecedor_id: string | null;
};

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function resizeImage(file: File, maxDim = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Dispara o worker para o job recém-criado em segundo plano.
 * `keepalive: true` faz o navegador manter a requisição viva mesmo se o usuário
 * sair da página. O `pg_cron` funciona como rede de segurança se algo falhar.
 */
function dispararWorker(jobId: string) {
  try {
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!anon) return;
    void fetch("/api/public/hooks/captura-worker", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon },
      body: JSON.stringify({ jobId }),
      keepalive: true,
    }).catch(() => { /* cron cobre */ });
  } catch { /* noop */ }
}

function CapturaPage() {
  const enfileirar = useServerFn(enfileirarCaptura);
  const listar = useServerFn(listarCapturaJobs);
  const reprocessar = useServerFn(reprocessarCapturaJob);
  const remover = useServerFn(removerCapturaJob);
  const { activeOrgId, activeOrg, loading: orgLoading } = useActiveOrg();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [mes, setMes] = useState(mesAtualISO());
  const [enviando, setEnviando] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);
  const inputCam = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async () => {
    if (!activeOrgId) { setJobs([]); return; }
    try {
      const r = await listar({ data: { organizationId: activeOrgId, mesReferencia: mes, limite: 100 } });
      setJobs((r.jobs ?? []) as Job[]);
    } catch (e) {
      console.warn("[captura] listar jobs falhou", e);
    }
  }, [activeOrgId, mes, listar]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  // Subscribe realtime → atualiza a lista quando qualquer job da org muda
  useEffect(() => {
    if (!activeOrgId) return;
    const channel = supabase
      .channel(`captura-jobs-${activeOrgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "captura_jobs", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          setJobs((prev) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string })?.id;
              return oldId ? prev.filter((j) => j.id !== oldId) : prev;
            }
            const novo = payload.new as Job;
            if (novo.mes_referencia !== mes) return prev;
            const i = prev.findIndex((j) => j.id === novo.id);
            if (i >= 0) {
              const cp = prev.slice();
              cp[i] = { ...cp[i], ...novo };
              return cp;
            }
            return [novo, ...prev];
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeOrgId, mes]);

  useEffect(() => {
    if (!activeOrgId) { setEventos([]); return; }
    (async () => {
      const { data } = await supabase
        .from("eventos_financeiros")
        .select("id, descricao, categoria, valor_previsto, data_vencimento, fornecedor_id")
        .eq("organization_id", activeOrgId)
        .eq("mes_referencia", mes);
      setEventos((data ?? []) as Evento[]);
    })();
  }, [mes, activeOrgId]);

  const enfileirarArquivo = useCallback(async (file: File) => {
    if (!activeOrgId) throw new Error("Selecione uma organização ativa");
    const arquivo = await resizeImage(file);
    const hash = await sha256(arquivo);
    const safeName = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const path = `${activeOrgId}/${hash.slice(0, 16)}-${safeName}`;

    const up = await supabase.storage.from("documentos").upload(path, arquivo, {
      upsert: true,
      contentType: arquivo.type || undefined,
    });
    if (up.error) throw up.error;

    const r = await enfileirar({
      data: {
        storagePath: path,
        hash,
        nomeArquivo: arquivo.name,
        mimeType: arquivo.type || null,
        tamanhoBytes: arquivo.size,
        mesReferencia: mes,
        organizationId: activeOrgId,
      },
    });
    dispararWorker(r.jobId);
    return r.jobId;
  }, [activeOrgId, mes, enfileirar]);

  const adicionar = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!activeOrgId) { toast.error("Selecione uma organização ativa"); return; }
    setEnviando(true);
    const arr = Array.from(files);
    let ok = 0, fail = 0;
    for (const f of arr) {
      try { await enfileirarArquivo(f); ok++; }
      catch (e) {
        console.error("[captura] enfileirar falhou", e);
        toast.error(`Falha ao enviar ${f.name}: ${e instanceof Error ? e.message : "erro"}`);
        fail++;
      }
    }
    setEnviando(false);
    if (ok) toast.success(`${ok} arquivo(s) enviados. Pode sair da página — o processamento continua em segundo plano.`);
    if (fail && !ok) toast.error(`${fail} arquivo(s) falharam no envio`);
  }, [activeOrgId, enfileirarArquivo]);

  async function reprocessarErros() {
    const erros = jobs.filter((j) => j.status === "erro");
    for (const j of erros) {
      try {
        await reprocessar({ data: { jobId: j.id } });
        dispararWorker(j.id);
      } catch (e) {
        console.warn("[captura] reprocessar falhou", e);
      }
    }
    toast.success(`Reagendados ${erros.length} arquivo(s)`);
  }

  async function reprocessarUm(jobId: string) {
    try {
      await reprocessar({ data: { jobId } });
      dispararWorker(jobId);
      toast.success("Reagendado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reagendar");
    }
  }

  async function removerUm(jobId: string) {
    try {
      await remover({ data: { jobId } });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  async function vincularManual(jobId: string, eventoId: string) {
    const j = jobs.find((x) => x.id === jobId);
    if (!j?.documento_id) return;
    const { error } = await supabase
      .from("documentos_anexos")
      .update({ evento_id: eventoId === "none" ? null : eventoId })
      .eq("id", j.documento_id);
    if (error) return toast.error(error.message);
    if (eventoId !== "none") {
      await supabase.from("eventos_financeiros").update({ status_documental: "completo" }).eq("id", eventoId);
    }
    setJobs((prev) => prev.map((x) => x.id === jobId ? { ...x, evento_id: eventoId === "none" ? null : eventoId } : x));
    toast.success("Vínculo atualizado");
  }

  function corStatus(s: Status): "default" | "secondary" | "destructive" | "outline" {
    if (s === "concluido") return "default";
    if (s === "erro" || s === "cancelado") return "destructive";
    if (s === "processando" || s === "pendente") return "secondary";
    return "outline";
  }

  const emAndamento = useMemo(
    () => jobs.filter((j) => j.status === "pendente" || j.status === "processando").length,
    [jobs],
  );

  return (
    <div className="p-8 space-y-6">
      <Toaster richColors position="top-right" />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl uppercase">Captura de documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload, foto ou scanner. Os dados são reconhecidos automaticamente em segundo plano — pode sair da página, o processamento continua.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Mês de busca</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-40" />
          </div>
        </div>
      </header>

      {!orgLoading && !activeOrgId && (
        <div className="border border-destructive/50 bg-destructive/10 text-destructive rounded-md px-4 py-3 text-sm">
          Nenhuma organização ativa selecionada. Use o seletor no topo do painel antes de enviar arquivos.
        </div>
      )}
      {activeOrg && (
        <div className="text-xs text-muted-foreground">
          Organização ativa: <strong>{activeOrg.nome}</strong>
          {emAndamento > 0 && (
            <span className="ml-3 inline-flex items-center gap-1 text-amber-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              {emAndamento} em processamento — pode sair da página
            </span>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-6 flex flex-wrap gap-3">
          <input
            ref={inputFile}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={inputCam}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { void adicionar(e.target.files); e.target.value = ""; }}
          />
          <Button onClick={() => inputFile.current?.click()} variant="outline" disabled={!activeOrgId || enviando}>
            <Upload className="mr-2 h-4 w-4" /> Selecionar arquivos
          </Button>
          <Button onClick={() => inputCam.current?.click()} variant="outline" disabled={!activeOrgId || enviando}>
            <Camera className="mr-2 h-4 w-4" /> Tirar foto
          </Button>
          {enviando && (
            <span className="self-center text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> enviando...
            </span>
          )}
          {jobs.some((j) => j.status === "erro") && (
            <Button onClick={reprocessarErros} variant="secondary" disabled={!activeOrgId}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reprocessar {jobs.filter((j) => j.status === "erro").length} erro(s)
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void recarregar()} className="ml-auto">
            <RefreshCw className="mr-2 h-4 w-4" /> atualizar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">
          Fila ({jobs.length})
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum arquivo no mês. Use os botões acima para adicionar.
            </div>
          )}
          {jobs.map((j) => {
            const d = j.dados ?? {};
            const evt = j.evento_id ? eventos.find((e) => e.id === j.evento_id) : null;
            return (
              <div key={j.id} className="border border-border rounded-md p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{j.nome_arquivo}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      {j.tamanho_bytes != null && <span>{(j.tamanho_bytes / 1024).toFixed(0)} KB</span>}
                      {d.tipo && <span>tipo: {d.tipo}</span>}
                      {d.cnpj && <span>CNPJ: {d.cnpj}</span>}
                      {d.valor != null && <span>R$ {Number(d.valor).toFixed(2)}</span>}
                      {(d.data_vencimento || d.data_emissao || d.data_pagamento) && (
                        <span>{d.data_vencimento ?? d.data_emissao ?? d.data_pagamento}</span>
                      )}
                    </div>
                    {j.mensagem && <div className="text-xs text-muted-foreground mt-1 italic">{j.mensagem}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={corStatus(j.status)}>
                      {(j.status === "processando" || j.status === "pendente") && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {j.status}
                    </Badge>
                    {(j.status === "erro" || j.status === "concluido") && (
                      <Button size="icon" variant="ghost" onClick={() => reprocessarUm(j.id)} title="Reprocessar">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => removerUm(j.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {j.status === "concluido" && j.documento_id && (
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Select value={j.evento_id ?? "none"} onValueChange={(v) => vincularManual(j.id, v)}>
                      <SelectTrigger className="max-w-md">
                        <SelectValue placeholder="Vincular a evento..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— sem vínculo —</SelectItem>
                        {eventos.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.categoria} · {e.descricao ?? "(sem descrição)"} · R$ {Number(e.valor_previsto ?? 0).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {evt && <span className="text-xs text-muted-foreground">→ {evt.descricao ?? evt.categoria}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
