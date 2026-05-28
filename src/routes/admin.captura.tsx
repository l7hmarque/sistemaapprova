import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Camera, Upload, Link2, Trash2, Loader2 } from "lucide-react";
import { extractPdfText } from "@/lib/pdf/extractTextClient";
import { extrairDocumento } from "@/lib/captura.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/admin/captura")({ component: CapturaPage });

type Status = "fila" | "processando" | "vinculado" | "orfao" | "duplicata" | "erro";

type Item = {
  id: string;
  file: File;
  hash?: string;
  status: Status;
  mensagem?: string;
  dados?: {
    tipo?: string;
    cnpj?: string | null;
    valor?: number | null;
    data?: string | null;
    numero?: string | null;
    descricao?: string;
  };
  eventoId?: string | null;
  docId?: string;
};

type Evento = {
  id: string;
  descricao: string | null;
  categoria: string;
  valor_previsto: number | null;
  data_vencimento: string | null;
  fornecedor_id: string | null;
};

type Fornecedor = { id: string; razao_social: string; cnpj: string };

async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const TOLERANCIA_PADRAO = { valor_centavos: 50, janela_dias: 3 };

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(r.error);
    r.onload = () => {
      const v = r.result as string;
      // strip prefix
      const i = v.indexOf(",");
      res(i >= 0 ? v.slice(i + 1) : v);
    };
    r.readAsDataURL(file);
  });
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
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", quality),
    );
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function msgErro(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.error === "string" && o.error) return o.error;
    if (typeof o.hint === "string" && o.hint) return o.hint;
    try { return JSON.stringify(e); } catch { /* noop */ }
  }
  return "Falha desconhecida";
}

function inferirCategoria(dados?: { tipo?: string; descricao?: string }): string {
  const txt = `${dados?.tipo ?? ""} ${dados?.descricao ?? ""}`.toLowerCase();
  if (/holerite|sal[áa]rio|folha|rescis[ãa]o|rpa/.test(txt)) return "salario";
  if (/energia|copel|eletric/.test(txt)) return "energia";
  if (/[áa]gua|sanepar|saae/.test(txt)) return "agua";
  if (/internet|telef|vivo|claro|tim|oi\b/.test(txt)) return "internet";
  if (/aluguel|loca[çc][ãa]o/.test(txt)) return "aluguel";
  if (/darf|gps|gfip|inss|fgts|iss|tribut|guia/.test(txt)) return "tributos";
  if (/manuten[çc][ãa]o|reparo|conserto/.test(txt)) return "manutencao";
  if (/servi[çc]o|nf|nfs|nota\s*fiscal/.test(txt)) return "servico";
  if (/boleto|fatura|cupom|compra/.test(txt)) return "compra_eventual";
  return "outros";
}

function CapturaPage() {
  const extrair = useServerFn(extrairDocumento);
  const { activeOrgId, activeOrg, loading: orgLoading } = useActiveOrg();
  const [itens, setItens] = useState<Item[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [tolerancia, setTolerancia] = useState(TOLERANCIA_PADRAO);
  const [mes, setMes] = useState(mesAtualISO());
  const inputFile = useRef<HTMLInputElement>(null);
  const inputCam = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeOrgId) {
      setEventos([]);
      setFornecedores([]);
      return;
    }
    (async () => {
      const [{ data: ev }, { data: fo }, { data: cfg }] = await Promise.all([
        supabase
          .from("eventos_financeiros")
          .select("id, descricao, categoria, valor_previsto, data_vencimento, fornecedor_id")
          .eq("organization_id", activeOrgId)
          .eq("mes_referencia", mes),
        supabase.from("fornecedores").select("id, razao_social, cnpj").eq("organization_id", activeOrgId),
        supabase.from("configuracoes").select("valor").eq("organization_id", activeOrgId).eq("chave", "auto_vinculo").maybeSingle(),
      ]);
      setEventos((ev ?? []) as Evento[]);
      setFornecedores((fo ?? []) as Fornecedor[]);
      const v = cfg?.valor as { valor_centavos?: number; janela_dias?: number } | undefined;
      if (v) {
        setTolerancia({
          valor_centavos: typeof v.valor_centavos === "number" ? v.valor_centavos : TOLERANCIA_PADRAO.valor_centavos,
          janela_dias: typeof v.janela_dias === "number" ? v.janela_dias : TOLERANCIA_PADRAO.janela_dias,
        });
      }
    })();
  }, [mes, activeOrgId]);




  const adicionar = useCallback((files: FileList | null) => {
    if (!files || !files.length) return;
    const novos: Item[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "fila",
    }));
    setItens((prev) => [...prev, ...novos]);
  }, []);

  function atualiza(id: string, patch: Partial<Item>) {
    setItens((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function tentarVincular(dados: Item["dados"]): string | null {
    if (!dados?.valor || !dados.cnpj) return null;
    const forn = fornecedores.find((f) => f.cnpj.replace(/\D/g, "") === String(dados.cnpj).replace(/\D/g, ""));
    if (!forn) return null;
    const tolValor = tolerancia.valor_centavos / 100;
    const tolMs = tolerancia.janela_dias * 24 * 60 * 60 * 1000;
    const candidatos = eventos.filter((e) => {
      if (e.fornecedor_id !== forn.id) return false;
      if (e.valor_previsto == null) return false;
      if (Math.abs(Number(e.valor_previsto) - Number(dados.valor)) > tolValor) return false;
      if (dados.data && e.data_vencimento) {
        const dDoc = new Date(dados.data).getTime();
        const dVen = new Date(e.data_vencimento).getTime();
        if (Math.abs(dDoc - dVen) > tolMs) return false;
      }
      return true;
    });
    if (candidatos.length === 1) return candidatos[0].id;
    return null;
  }

  async function processar(it: Item) {
    if (!activeOrgId) {
      atualiza(it.id, { status: "erro", mensagem: "Selecione uma organização ativa antes de processar" });
      return;
    }
    atualiza(it.id, { status: "processando", mensagem: "calculando hash" });
    try {
      const arquivo = await resizeImage(it.file);
      const hash = await sha256(arquivo);


      // Dedup local pelo hash — se já existe um registro com evento vinculado,
      // consideramos concluído. Caso contrário, reaproveitamos dados e seguimos
      // o fluxo para criar/lançar o evento.
      const { data: existentes } = await supabase
        .from("documentos_anexos")
        .select("id, evento_id, tipo, cnpj_extraido, valor_extraido, data_extraida, numero_extraido, metadata")
        .eq("arquivo_hash", hash)
        .eq("organization_id", activeOrgId)
        .limit(1);
      const gemeo = existentes && existentes.length ? existentes[0] : null;
      if (gemeo && gemeo.evento_id) {
        atualiza(it.id, {
          status: "vinculado",
          hash,
          mensagem: "Arquivo já cadastrado e vinculado",
          docId: gemeo.id,
          eventoId: gemeo.evento_id,
          dados: {
            tipo: gemeo.tipo ?? undefined,
            cnpj: gemeo.cnpj_extraido,
            valor: gemeo.valor_extraido != null ? Number(gemeo.valor_extraido) : null,
            data: gemeo.data_extraida,
            numero: gemeo.numero_extraido,
          },
        });
        return;
      }

      let dados: Item["dados"] = {};
      if (gemeo) {
        // Reaproveita extração anterior — pula chamada de IA
        atualiza(it.id, { mensagem: "reaproveitando extração anterior" });
        dados = {
          tipo: gemeo.tipo ?? undefined,
          cnpj: gemeo.cnpj_extraido ?? undefined,
          valor: gemeo.valor_extraido != null ? Number(gemeo.valor_extraido) : undefined,
          data: gemeo.data_extraida ?? undefined,
          numero: gemeo.numero_extraido ?? undefined,
          descricao:
            (gemeo.metadata && typeof gemeo.metadata === "object" && "descricao" in gemeo.metadata
              ? ((gemeo.metadata as Record<string, unknown>).descricao as string | null)
              : null) ?? undefined,
        };
      } else {
        atualiza(it.id, { mensagem: "extraindo conteúdo" });
        let texto = "";
        const ehPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
        const ehImagem = arquivo.type.startsWith("image/");
        if (ehPdf) {
          try { texto = await extractPdfText(arquivo); } catch (e) { console.warn("pdf text falhou", e); }
        }

        atualiza(it.id, { mensagem: "processando documento" });
        const temTextoUtil = texto.trim().length > 20;
        if (temTextoUtil || ehImagem) {
          const payload: { texto?: string; imagemBase64?: string; mimeType?: string; nomeArquivo: string } = {
            nomeArquivo: arquivo.name,
          };
          if (temTextoUtil) payload.texto = texto;
          if (ehImagem && !temTextoUtil) {
            payload.imagemBase64 = await fileToBase64(arquivo);
            payload.mimeType = arquivo.type || "image/jpeg";
          }
          const r = (await extrair({ data: payload })) as
            | { ok: true; dados: Item["dados"] }
            | { ok: false; erro: string };
          if (r.ok) {
            dados = r.dados;
          } else {
            dados = { descricao: arquivo.name, tipo: "outro" };
          }
        } else {
          dados = { descricao: arquivo.name, tipo: "outro" };
        }
      }



      atualiza(it.id, { mensagem: "enviando arquivo" });
      if (!activeOrgId) throw new Error("Selecione uma organização ativa antes de processar");
      const safeName = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `${activeOrgId}/${hash.slice(0, 16)}-${safeName}`;
      const up = await supabase.storage.from("documentos").upload(path, arquivo, {
        upsert: true,
        contentType: arquivo.type || undefined,
      });
      if (up.error) {
        console.error("[captura] storage upload error", up.error, { path, activeOrgId });
        throw up.error;
      }
      const { data: signed, error: signedErr } = await supabase
        .storage
        .from("documentos")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signedErr) console.warn("[captura] signed url falhou", signedErr);

      let eventoId = tentarVincular(dados);
      let eventoCriado = false;

      // Se não casou com nenhum evento existente e a extração tem valor mínimo,
      // criamos um novo evento financeiro automaticamente.
      const valorNum = dados?.valor != null ? Number(dados.valor) : null;
      const temDadosMinimos = valorNum != null && Number.isFinite(valorNum) && valorNum > 0;
      if (!eventoId && temDadosMinimos) {
        const fornEncontrado = dados?.cnpj
          ? fornecedores.find(
              (f) => f.cnpj.replace(/\D/g, "") === String(dados.cnpj).replace(/\D/g, ""),
            )
          : null;
        const mesRef = dados?.data && /^\d{4}-\d{2}-\d{2}$/.test(dados.data)
          ? dados.data.slice(0, 7)
          : mes;
        const categoria = inferirCategoria(dados);
        const descricao = (dados?.descricao && dados.descricao.trim())
          || (dados?.tipo ? `${dados.tipo} ${dados?.numero ?? ""}`.trim() : it.file.name);
        const evIns = await supabase
          .from("eventos_financeiros")
          .insert({
            organization_id: activeOrgId,
            mes_referencia: mesRef,
            categoria,
            descricao,
            fornecedor_id: fornEncontrado?.id ?? null,
            valor_previsto: valorNum,
            valor_efetivo: valorNum,
            data_vencimento: dados?.data ?? null,
            data_pagamento: dados?.data ?? null,
            origem: "captura",
            status_documental: "completo",
            metadata: {
              tipo: dados?.tipo ?? null,
              cnpj_extraido: dados?.cnpj ?? null,
              numero_extraido: dados?.numero ?? null,
              nome_arquivo: it.file.name,
              criado_via: "captura",
            },
          })
          .select("id, descricao, categoria, valor_previsto, data_vencimento, fornecedor_id")
          .single();
        if (evIns.error) {
          console.error("[captura] insert eventos_financeiros error", evIns.error, { activeOrgId });
          throw evIns.error;
        }
        eventoId = evIns.data.id;
        eventoCriado = true;
        // Atualiza lista local para próximos itens da fila reaproveitarem o evento.
        setEventos((prev) => [
          ...prev,
          {
            id: evIns.data.id,
            descricao: evIns.data.descricao,
            categoria: evIns.data.categoria,
            valor_previsto: evIns.data.valor_previsto,
            data_vencimento: evIns.data.data_vencimento,
            fornecedor_id: evIns.data.fornecedor_id,
          },
        ]);
      }

      const insertRes = await supabase
        .from("documentos_anexos")
        .insert({
          organization_id: activeOrgId,
          tipo: dados?.tipo ?? "outro",
          arquivo_url: signed?.signedUrl ?? null,
          arquivo_hash: hash,
          cnpj_extraido: dados?.cnpj ?? null,
          valor_extraido: dados?.valor ?? null,
          numero_extraido: dados?.numero ?? null,
          data_extraida: dados?.data ?? null,
          origem: "manual",
          evento_id: eventoId,
          metadata: {
            nome_original: it.file.name,
            descricao: dados?.descricao ?? null,
            storage_path: path,
            bucket: "documentos",
          },
        })
        .select("id")
        .single();
      if (insertRes.error) {
        console.error("[captura] insert documentos_anexos error", insertRes.error, { activeOrgId });
        throw insertRes.error;
      }

      if (eventoId && !eventoCriado) {
        await supabase
          .from("eventos_financeiros")
          .update({ status_documental: "completo" })
          .eq("id", eventoId);
      }

      atualiza(it.id, {
        status: eventoId ? "vinculado" : "orfao",
        hash,
        dados,
        docId: insertRes.data.id,
        eventoId,
        mensagem: eventoCriado
          ? "Lançado automaticamente"
          : eventoId
            ? "Vinculado a evento existente"
            : "Sem valor extraído — revisar manualmente",
      });
    } catch (e) {
      console.error("[captura] falha ao processar", e);
      atualiza(it.id, {
        status: "erro",
        mensagem: msgErro(e),
      });

    }
  }

  async function processarTudo() {
    const pend = itens.filter((i) => i.status === "fila");
    for (const it of pend) {
      // eslint-disable-next-line no-await-in-loop
      await processar(it);
    }
    toast.success(`Processados ${pend.length} arquivo(s)`);
  }

  async function vincularManual(itemId: string, eventoId: string) {
    const it = itens.find((i) => i.id === itemId);
    if (!it?.docId) return;
    const { error } = await supabase
      .from("documentos_anexos")
      .update({ evento_id: eventoId === "none" ? null : eventoId })
      .eq("id", it.docId);
    if (error) return toast.error(error.message);
    if (eventoId !== "none") {
      await supabase.from("eventos_financeiros").update({ status_documental: "completo" }).eq("id", eventoId);
    }
    atualiza(itemId, {
      eventoId: eventoId === "none" ? null : eventoId,
      status: eventoId === "none" ? "orfao" : "vinculado",
      mensagem: eventoId === "none" ? "Desvinculado" : "Vinculado manualmente",
    });
    toast.success("Vínculo atualizado");
  }

  function remover(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id));
  }

  function corStatus(s: Status): "default" | "secondary" | "destructive" | "outline" {
    if (s === "vinculado") return "default";
    if (s === "duplicata" || s === "erro") return "destructive";
    if (s === "processando") return "secondary";
    return "outline";
  }

  return (
    <div className="p-8 space-y-6">
      <Toaster richColors position="top-right" />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl uppercase">Captura de documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload, foto ou scanner. Os dados são reconhecidos automaticamente e vinculados ao evento do mês.
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
          Nenhuma organização ativa selecionada. Use o seletor no topo do painel antes de processar arquivos.
        </div>
      )}
      {activeOrg && (
        <div className="text-xs text-muted-foreground">
          Organização ativa: <strong>{activeOrg.nome}</strong>
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
            onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={inputCam}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }}
          />
          <Button onClick={() => inputFile.current?.click()} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Selecionar arquivos
          </Button>
          <Button onClick={() => inputCam.current?.click()} variant="outline">
            <Camera className="mr-2 h-4 w-4" /> Tirar foto
          </Button>
          <Button onClick={processarTudo} disabled={!activeOrgId || !itens.some((i) => i.status === "fila")}>
            Processar fila
          </Button>
          <div className="ml-auto text-xs text-muted-foreground self-center">
            {eventos.length} evento(s) candidato(s) em {mes}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">
          Fila ({itens.length})
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {itens.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum arquivo. Use os botões acima para adicionar.
            </div>
          )}
          {itens.map((it) => {
            const evt = it.eventoId ? eventos.find((e) => e.id === it.eventoId) : null;
            return (
              <div key={it.id} className="border border-border rounded-md p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.file.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      <span>{(it.file.size / 1024).toFixed(0)} KB</span>
                      {it.dados?.tipo && <span>tipo: {it.dados.tipo}</span>}
                      {it.dados?.cnpj && <span>CNPJ: {it.dados.cnpj}</span>}
                      {it.dados?.valor != null && <span>R$ {Number(it.dados.valor).toFixed(2)}</span>}
                      {it.dados?.data && <span>{it.dados.data}</span>}
                    </div>
                    {it.mensagem && <div className="text-xs text-muted-foreground mt-1 italic">{it.mensagem}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={corStatus(it.status)}>
                      {it.status === "processando" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {it.status}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => remover(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {(it.status === "orfao" || it.status === "vinculado") && it.docId && (
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Select value={it.eventoId ?? "none"} onValueChange={(v) => vincularManual(it.id, v)}>
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
