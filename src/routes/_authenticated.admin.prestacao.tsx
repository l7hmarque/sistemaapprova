import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, ArrowUp, ArrowDown, FileDown, ExternalLink, AlertTriangle, RotateCcw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useServerFn } from "@tanstack/react-start";
import { gerarPrestacaoContas } from "@/lib/prestacao.functions";

import { Badge } from "@/components/ui/badge";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/_authenticated/admin/prestacao")({ component: PrestacaoPage });

type Doc = {
  id: string;
  ordem: number;
  nome: string;
  descricao: string | null;
  arquivo_url: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  mes_referencia: string | null;
  mes_referencia_fim: string | null;
  valido_de: string | null;
  valido_ate: string | null;
};

type Snapshot = {
  id: string;
  titulo: string | null;
  assinatura_hash: string;
  total_eventos: number;
  total_documentos: number;
  gerado_em: string;
  pdf_path: string | null;
};

const mesAtual = new Date().toISOString().slice(0, 7);

function mesAnterior(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PrestacaoPage() {
  const [mes, setMes] = useState(mesAtual);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Partial<Doc> | null>(null);
  const [excluindo, setExcluindo] = useState<Doc | null>(null);
  const [opcaoExclusao, setOpcaoExclusao] = useState<"so-mes" | "seguintes" | "tudo">("so-mes");
  const [gerando, setGerando] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const gerar = useServerFn(gerarPrestacaoContas);
  const { activeOrgId } = useActiveOrg();

  const carregar = async () => {
    if (!activeOrgId) { setDocs([]); setSnapshots([]); return; }
    setLoading(true);
    const primeiroDia = `${mes}-01`;
    const [docsRes, snapRes] = await Promise.all([
      supabase
        .from("prestacao_documentos")
        .select("id, ordem, nome, descricao, arquivo_url, data_emissao, data_vencimento, mes_referencia, mes_referencia_fim, valido_de, valido_ate")
        .eq("organization_id", activeOrgId)
        .lte("mes_referencia", mes)
        .or(`mes_referencia_fim.is.null,mes_referencia_fim.gte.${mes}`)
        .or(`valido_ate.is.null,valido_ate.gte.${primeiroDia}`)
        .order("ordem", { ascending: true }),
      supabase
        .from("prestacoes_snapshot")
        .select("id, titulo, assinatura_hash, total_eventos, total_documentos, gerado_em, pdf_path")
        .eq("organization_id", activeOrgId)
        .eq("mes_referencia", mes)
        .order("gerado_em", { ascending: false }),
    ]);
    if (docsRes.error) toast.error("Erro: " + docsRes.error.message);
    let filtrados = ((docsRes.data as any) ?? []) as Doc[];
    // Remove os que têm exceção para este mês
    if (filtrados.length > 0) {
      const ids = filtrados.map((d) => d.id);
      const { data: exc } = await supabase
        .from("prestacao_documentos_excecoes")
        .select("documento_id")
        .in("documento_id", ids)
        .eq("mes_referencia", mes);
      const bloq = new Set((exc ?? []).map((e: any) => e.documento_id));
      filtrados = filtrados.filter((d) => !bloq.has(d.id));
    }
    setDocs(filtrados);
    setSnapshots((snapRes.data as any) ?? []);
    setLoading(false);
  };

  const baixarPdfDoStorage = async (storagePath: string, filename: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Sessão expirada, faça login novamente.");
    const res = await fetch(`/api/prestacao/download?path=${encodeURIComponent(storagePath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Falha ao baixar PDF (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const abrirSnapshot = async (s: Snapshot) => {
    try {
      if (!s.pdf_path) throw new Error("Snapshot sem arquivo salvo");
      await baixarPdfDoStorage(s.pdf_path, `prestacao-${mes}.pdf`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao abrir");
    }
  };

  useEffect(() => { void carregar(); }, [mes, activeOrgId]);

  const novo = (base?: Partial<Doc>) => setEdit({
    nome: base?.nome ?? "",
    descricao: base?.descricao ?? "",
    arquivo_url: "",
    data_emissao: null,
    data_vencimento: null,
    valido_de: new Date().toISOString().slice(0, 10),
    valido_ate: null,
    mes_referencia: mes,
    ordem: (docs[docs.length - 1]?.ordem ?? 0) + 1,
  });

  const salvar = async () => {
    if (!edit) return;
    if (!edit.nome?.trim()) return toast.error("Informe o nome do documento");
    const payload = {
      nome: edit.nome.trim(),
      descricao: edit.descricao?.trim() || null,
      arquivo_url: edit.arquivo_url?.trim() || null,
      data_emissao: edit.data_emissao || null,
      data_vencimento: edit.data_vencimento || null,
      valido_de: edit.valido_de || edit.data_emissao || `${edit.mes_referencia ?? mes}-01`,
      valido_ate: edit.valido_ate || edit.data_vencimento || null,
      mes_referencia: edit.mes_referencia || mes,
      ordem: edit.ordem ?? 0,
    };
    const q = edit.id
      ? supabase.from("prestacao_documentos").update(payload).eq("id", edit.id)
      : (activeOrgId
          ? supabase.from("prestacao_documentos").insert({ ...payload, organization_id: activeOrgId })
          : null);
    if (!q) return toast.error("Selecione uma organização ativa");
    const { error } = await q;
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Salvo");
    setEdit(null);
    void carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluindo || !activeOrgId) return;
    const d = excluindo;
    if (opcaoExclusao === "tudo") {
      const { error } = await supabase.from("prestacao_documentos").delete().eq("id", d.id);
      if (error) return toast.error(error.message);
      toast.success("Documento removido de todos os meses");
    } else if (opcaoExclusao === "seguintes") {
      const corte = mesAnterior(mes);
      const { error } = await supabase
        .from("prestacao_documentos")
        .update({ mes_referencia_fim: corte })
        .eq("id", d.id);
      if (error) return toast.error(error.message);
      toast.success(`Documento não aparecerá mais a partir de ${mes}`);
    } else {
      const { error } = await supabase
        .from("prestacao_documentos_excecoes")
        .insert({ documento_id: d.id, organization_id: activeOrgId, mes_referencia: mes });
      if (error) return toast.error(error.message);
      toast.success(`Documento removido apenas de ${mes}`);
    }
    setExcluindo(null);
    setOpcaoExclusao("so-mes");
    void carregar();
  };

  const mover = async (idx: number, dir: -1 | 1) => {
    const a = docs[idx], b = docs[idx + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("prestacao_documentos").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("prestacao_documentos").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    void carregar();
  };

  const gerarOficial = async () => {
    setGerando(true);
    const t = toast.loading("Gerando PDF e salvando…");
    try {
      const r = await gerar({ data: { mesReferencia: mes } });
      toast.success(
        `PDF pronto: ${r.totalPaginas} pág. · ${r.totalDocs} docs · ${r.totalComprovantes} comprovantes`,
        { id: t },
      );
      // Baixa via proxy no mesmo domínio (evita ad-blockers que barram *.supabase.co)
      // e abre como blob local — nenhuma URL externa exposta.
      if (r.storagePath) {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Sessão expirada, faça login novamente.");
        const res = await fetch(`/api/prestacao/download?path=${encodeURIComponent(r.storagePath)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Falha ao baixar PDF (${res.status})`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        // libera o blob após um tempo
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } else if (r.driveUrl) {
        window.open(r.driveUrl, "_blank");
      }
      void carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar relatório", { id: t });
    } finally {
      setGerando(false);
    }
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const em30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase">Prestação de Contas</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cadastre os documentos do mês na ordem desejada. Documentos com validade que
            atravessa meses (ex.: certidões) reaparecem automaticamente enquanto vigentes.
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
          </div>
          <Button onClick={() => novo()} variant="outline"><Plus className="h-4 w-4 mr-1" />Documento</Button>
          <Button onClick={gerarOficial} disabled={gerando}>
            <FileDown className="h-4 w-4 mr-1" />
            {gerando ? "Gerando…" : "Gerar relatório"}
          </Button>
        </div>
      </header>

      {snapshots.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Prestações fechadas em {mes}
            </div>
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b last:border-0 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{s.titulo ?? `Prestação ${mes}`}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                    <span>{new Date(s.gerado_em).toLocaleString("pt-BR")}</span>
                    <span>{s.total_eventos} eventos · {s.total_documentos} docs</span>
                    <span className="font-mono text-[10px]">SHA-256 {s.assinatura_hash.slice(0, 16)}…</span>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">imutável</Badge>
                <Button size="sm" variant="outline" onClick={() => abrirSnapshot(s)}>
                  <FileDown className="h-4 w-4 mr-1" /> Abrir PDF
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : docs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum documento vigente para {mes}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {docs.map((d, i) => {
            const validade = d.valido_ate ?? d.data_vencimento;
            const vencido = !!validade && validade < hoje;
            const proximo = !!validade && validade >= hoje && validade <= em30;
            const outroMes = d.mes_referencia && d.mes_referencia !== mes;
            return (
              <Card key={d.id} className={vencido ? "border-destructive" : proximo ? "border-yellow-500" : ""}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="font-display text-2xl w-10 text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                      {d.nome}
                      {vencido ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />vencido</Badge>
                      ) : proximo ? (
                        <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-500 text-white"><AlertTriangle className="h-3 w-3" />vence em breve</Badge>
                      ) : validade ? (
                        <Badge variant="outline">vigente</Badge>
                      ) : null}
                      {outroMes && (
                        <Badge variant="secondary" className="text-[10px]">cadastrado em {d.mes_referencia}</Badge>
                      )}
                    </div>
                    {d.descricao && <div className="text-xs text-muted-foreground mt-0.5">{d.descricao}</div>}
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                      {d.data_emissao && <span>Emissão: <strong className="text-foreground">{fmt(d.data_emissao)}</strong></span>}
                      {validade && <span>Válido até: <strong className="text-foreground">{fmt(validade)}</strong></span>}
                    </div>
                    {vencido && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs"
                        onClick={() => novo({ nome: d.nome, descricao: d.descricao })}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Cadastrar novo em substituição
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => mover(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => mover(i, 1)} disabled={i === docs.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    {d.arquivo_url && (
                      <Button size="icon" variant="ghost" asChild>
                        <a href={d.arquivo_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => setEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setExcluindo(d); setOpcaoExclusao("so-mes"); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}




      {/* Modal de edição */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar documento" : "Novo documento"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Nome">
                <Input value={edit.nome ?? ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
              </Field>
              <Field label="Descrição (opcional)">
                <Textarea rows={2} value={edit.descricao ?? ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} />
              </Field>
              <Field label="URL do arquivo (Drive ou link)">
                <Input value={edit.arquivo_url ?? ""} onChange={(e) => setEdit({ ...edit, arquivo_url: e.target.value })} placeholder="https://drive.google.com/…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de emissão">
                  <Input type="date" value={edit.data_emissao ?? ""} onChange={(e) => setEdit({ ...edit, data_emissao: e.target.value || null })} />
                </Field>
                <Field label="Válido até (opcional)">
                  <Input type="date" value={edit.valido_ate ?? ""} onChange={(e) => setEdit({ ...edit, valido_ate: e.target.value || null })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Se preencher "Válido até", o documento aparece automaticamente em todos os meses até essa data.
              </p>
              <Field label="Mês de referência (cadastro inicial)">
                <Input type="month" value={edit.mes_referencia ?? mes} onChange={(e) => setEdit({ ...edit, mes_referencia: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de exclusão com 3 opções */}
      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir "{excluindo?.nome}"</DialogTitle>
            <DialogDescription>Escolha o alcance da exclusão:</DialogDescription>
          </DialogHeader>
          <RadioGroup value={opcaoExclusao} onValueChange={(v) => setOpcaoExclusao(v as any)} className="space-y-3">
            <label className="flex gap-3 items-start cursor-pointer">
              <RadioGroupItem value="so-mes" className="mt-1" />
              <div>
                <div className="font-medium text-sm">Excluir apenas de {mes}</div>
                <div className="text-xs text-muted-foreground">O documento continua aparecendo em outros meses onde é vigente.</div>
              </div>
            </label>
            <label className="flex gap-3 items-start cursor-pointer">
              <RadioGroupItem value="seguintes" className="mt-1" />
              <div>
                <div className="font-medium text-sm">Excluir de {mes} em diante</div>
                <div className="text-xs text-muted-foreground">Mantém histórico nos meses anteriores; não aparece mais a partir daqui.</div>
              </div>
            </label>
            <label className="flex gap-3 items-start cursor-pointer">
              <RadioGroupItem value="tudo" className="mt-1" />
              <div>
                <div className="font-medium text-sm">Excluir de todos os meses</div>
                <div className="text-xs text-muted-foreground">Remove o documento permanentemente do sistema.</div>
              </div>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
