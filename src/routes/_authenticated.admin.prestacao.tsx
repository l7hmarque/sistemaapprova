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
  Plus, Trash2, Pencil, ArrowUp, ArrowDown, FileDown, ExternalLink, AlertTriangle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { gerarPrestacaoContas } from "@/lib/prestacao.functions";
import { obterUrlSnapshot } from "@/lib/prestacao-snapshot.functions";
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

function PrestacaoPage() {
  const [mes, setMes] = useState(mesAtual);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Partial<Doc> | null>(null);
  const [gerando, setGerando] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const gerar = useServerFn(gerarPrestacaoContas);
  const abrirSnap = useServerFn(obterUrlSnapshot);
  const { activeOrgId } = useActiveOrg();

  const carregar = async () => {
    if (!activeOrgId) { setDocs([]); setSnapshots([]); return; }
    setLoading(true);
    const [docsRes, snapRes] = await Promise.all([
      supabase
        .from("prestacao_documentos")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("mes_referencia", mes)
        .order("ordem", { ascending: true }),
      supabase
        .from("prestacoes_snapshot")
        .select("id, titulo, assinatura_hash, total_eventos, total_documentos, gerado_em, pdf_path")
        .eq("organization_id", activeOrgId)
        .eq("mes_referencia", mes)
        .order("gerado_em", { ascending: false }),
    ]);
    if (docsRes.error) toast.error("Erro: " + docsRes.error.message);
    setDocs((docsRes.data as any) ?? []);
    setSnapshots((snapRes.data as any) ?? []);
    setLoading(false);
  };

  const abrirSnapshot = async (id: string) => {
    try {
      const r = await abrirSnap({ data: { id } });
      window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao abrir");
    }
  };

  useEffect(() => { void carregar(); }, [mes, activeOrgId]);

  const novo = () => setEdit({
    nome: "", descricao: "", arquivo_url: "",
    data_emissao: null, data_vencimento: null,
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

  const excluir = async (d: Doc) => {
    if (!confirm(`Excluir "${d.nome}"?`)) return;
    const { error } = await supabase.from("prestacao_documentos").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
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

  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      const r = await gerar({ data: { mesReferencia: mes } });
      toast.success("Relatório gerado!");
      window.open(r.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar relatório");
    } finally {
      setGerando(false);
    }
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const proximo30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase">Prestação de Contas</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cadastre os documentos do mês na ordem desejada. Ao gerar o relatório, o template do
            Google Docs configurado é copiado e a lista é anexada ao final.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
          </div>
          <Button onClick={novo} variant="outline"><Plus className="h-4 w-4 mr-1" />Documento</Button>
          <Button onClick={gerarRelatorio} disabled={gerando || docs.length === 0}>
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
                <Button size="sm" variant="outline" onClick={() => abrirSnapshot(s.id)}>
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
          Nenhum documento cadastrado para {mes}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {docs.map((d, i) => {
            const vencido = d.data_vencimento && d.data_vencimento < hoje;
            const proximo = d.data_vencimento && d.data_vencimento >= hoje && d.data_vencimento <= proximo30;
            return (
              <Card key={d.id} className={vencido ? "border-destructive" : proximo ? "border-yellow-500" : ""}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="font-display text-2xl w-10 text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {d.nome}
                      {vencido && <span className="inline-flex items-center text-xs text-destructive gap-1"><AlertTriangle className="h-3 w-3" />vencido</span>}
                      {!vencido && proximo && <span className="inline-flex items-center text-xs text-yellow-600 gap-1"><AlertTriangle className="h-3 w-3" />vence em breve</span>}
                    </div>
                    {d.descricao && <div className="text-xs text-muted-foreground mt-0.5">{d.descricao}</div>}
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                      {d.data_emissao && <span>Emissão: <strong className="text-foreground">{fmt(d.data_emissao)}</strong></span>}
                      {d.data_vencimento && <span>Vencimento: <strong className="text-foreground">{fmt(d.data_vencimento)}</strong></span>}
                    </div>
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
                    <Button size="icon" variant="ghost" onClick={() => excluir(d)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
                <Field label="Data de vencimento">
                  <Input type="date" value={edit.data_vencimento ?? ""} onChange={(e) => setEdit({ ...edit, data_vencimento: e.target.value || null })} />
                </Field>
              </div>
              <Field label="Mês de referência">
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
