import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Plus, Trash2, Pencil, FileWarning, FileCheck2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarPrestacaoSnapshot } from "@/lib/prestacao-snapshot.functions";

export const Route = createFileRoute("/admin/painel")({ component: PainelPage });

type Evento = {
  id: string;
  mes_referencia: string;
  fornecedor_id: string | null;
  categoria: string;
  descricao: string | null;
  valor_previsto: number | null;
  valor_efetivo: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  origem: string;
  status_documental: string;
  metadata?: Record<string, unknown> | null;
};

type Fornecedor = { id: string; razao_social: string; cnpj: string };

const CATEGORIAS = [
  "energia", "agua", "internet", "aluguel", "salario",
  "servico", "compra_eventual", "tributos", "manutencao", "outros",
];

const ORIGENS = ["manual", "orcamento", "gmail", "foto"];

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "completo") return "default";
  if (s === "divergente" || s === "duplicata_suspeita") return "destructive";
  if (s === "faltando") return "secondary";
  return "outline";
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PainelPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [mes, setMes] = useState(mesAtual());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [editing, setEditing] = useState<Evento | null>(null);
  const [open, setOpen] = useState(false);
  const [fechando, setFechando] = useState(false);
  const fecharMes = useServerFn(gerarPrestacaoSnapshot);

  async function handleFecharMes() {
    if (eventos.length === 0) return toast.error("Sem eventos no mês.");
    const incompletos = eventos.filter((e) => e.status_documental !== "completo").length;
    const msg = incompletos > 0
      ? `Atenção: ${incompletos} de ${eventos.length} eventos não estão marcados como "completo". Gerar mesmo assim?`
      : `Fechar ${mes} e gerar prestação imutável com ${eventos.length} eventos?`;
    if (!confirm(msg)) return;
    setFechando(true);
    try {
      const r = await fecharMes({ data: { mesReferencia: mes } });
      toast.success(`Prestação gerada — ${r.totalEventos} eventos, ${r.totalDocumentos} docs`);
      if (r.url) window.open(r.url, "_blank");
      void recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar");
    } finally {
      setFechando(false);
    }
  }

  async function recarregar() {
    const { data, error } = await supabase
      .from("eventos_financeiros")
      .select("*")
      .eq("mes_referencia", mes)
      .order("data_vencimento", { ascending: true, nullsFirst: false });
    if (error) toast.error("Falha ao carregar eventos: " + error.message);
    else setEventos((data ?? []) as Evento[]);
  }

  useEffect(() => { void recarregar(); }, [mes]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fornecedores").select("id, razao_social, cnpj").order("razao_social");
      setFornecedores((data ?? []) as Fornecedor[]);
    })();
  }, []);

  const filtrados = useMemo(
    () => eventos.filter((e) => filtroCategoria === "todas" || e.categoria === filtroCategoria),
    [eventos, filtroCategoria],
  );

  const totais = useMemo(() => {
    const prev = filtrados.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
    const efet = filtrados.reduce((s, e) => s + (Number(e.valor_efetivo) || 0), 0);
    return { prev, efet, dif: efet - prev };
  }, [filtrados]);

  async function remover(id: string) {
    if (!confirm("Remover este evento?")) return;
    const { error } = await supabase.from("eventos_financeiros").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Evento removido");
    recarregar();
  }

  function abrirNovo() {
    setEditing({
      id: "",
      mes_referencia: mes,
      fornecedor_id: null,
      categoria: "outros",
      descricao: "",
      valor_previsto: null,
      valor_efetivo: null,
      data_vencimento: null,
      data_pagamento: null,
      origem: "manual",
      status_documental: "pendente",
    });
    setOpen(true);
  }

  function abrirEdit(e: Evento) {
    setEditing({ ...e });
    setOpen(true);
  }

  async function salvar() {
    if (!editing) return;
    const payload = {
      mes_referencia: editing.mes_referencia,
      fornecedor_id: editing.fornecedor_id,
      categoria: editing.categoria,
      descricao: editing.descricao,
      valor_previsto: editing.valor_previsto,
      valor_efetivo: editing.valor_efetivo,
      data_vencimento: editing.data_vencimento,
      data_pagamento: editing.data_pagamento,
      origem: editing.origem,
      status_documental: editing.status_documental,
    };
    if (editing.id) {
      const { error } = await supabase.from("eventos_financeiros").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("eventos_financeiros").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Evento salvo");
    setOpen(false);
    setEditing(null);
    recarregar();
  }

  return (
    <div className="p-8 space-y-6">
      <Toaster richColors position="top-right" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl uppercase">Painel financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Eventos previstos e efetivos do mês. Base única para Cofre e Prestação.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Mês de referência</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={abrirNovo}><Plus className="mr-1 h-4 w-4" /> Novo evento</Button>
          <Button onClick={handleFecharMes} disabled={fechando} variant="secondary">
            <FileCheck2 className="mr-1 h-4 w-4" />
            {fechando ? "Gerando…" : "Fechar mês"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Previsto</div>
          <div className="font-display text-3xl mt-2">R$ {totais.prev.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Efetivo</div>
          <div className="font-display text-3xl mt-2">R$ {totais.efet.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Diferença</div>
          <div className={`font-display text-3xl mt-2 ${totais.dif > 0 ? "text-destructive" : ""}`}>
            R$ {totais.dif.toFixed(2)}
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">
          Eventos ({filtrados.length})
        </CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencim.</TableHead>
                <TableHead>Pgto</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Efetivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  <FileWarning className="mx-auto mb-2 h-5 w-5 opacity-50" />
                  Nenhum evento neste mês. Clique em "Novo evento" para começar.
                </TableCell></TableRow>
              )}
              {filtrados.map((e) => {
                const forn = fornecedores.find((f) => f.id === e.fornecedor_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{e.categoria}</TableCell>
                    <TableCell>{e.descricao || "—"}</TableCell>
                    <TableCell className="text-xs">{forn?.razao_social ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.data_vencimento ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.data_pagamento ?? "—"}</TableCell>
                    <TableCell className="text-right">{e.valor_previsto != null ? Number(e.valor_previsto).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right">{e.valor_efetivo != null ? Number(e.valor_efetivo).toFixed(2) : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(e.status_documental)}>{e.status_documental}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remover(e.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês</Label>
                <Input type="month" value={editing.mes_referencia}
                  onChange={(e) => setEditing({ ...editing, mes_referencia: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editing.categoria}
                  onValueChange={(v) => setEditing({ ...editing, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Input value={editing.descricao ?? ""}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Fornecedor</Label>
                <Select value={editing.fornecedor_id ?? "none"}
                  onValueChange={(v) => setEditing({ ...editing, fornecedor_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem fornecedor —</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor previsto</Label>
                <Input type="number" step="0.01" value={editing.valor_previsto ?? ""}
                  onChange={(e) => setEditing({ ...editing, valor_previsto: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Valor efetivo</Label>
                <Input type="number" step="0.01" value={editing.valor_efetivo ?? ""}
                  onChange={(e) => setEditing({ ...editing, valor_efetivo: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={editing.data_vencimento ?? ""}
                  onChange={(e) => setEditing({ ...editing, data_vencimento: e.target.value || null })} />
              </div>
              <div>
                <Label>Pagamento</Label>
                <Input type="date" value={editing.data_pagamento ?? ""}
                  onChange={(e) => setEditing({ ...editing, data_pagamento: e.target.value || null })} />
              </div>
              <div>
                <Label>Origem</Label>
                <Select value={editing.origem} onValueChange={(v) => setEditing({ ...editing, origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status documental</Label>
                <Select value={editing.status_documental} onValueChange={(v) => setEditing({ ...editing, status_documental: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">pendente</SelectItem>
                    <SelectItem value="faltando">faltando</SelectItem>
                    <SelectItem value="completo">completo</SelectItem>
                    <SelectItem value="divergente">divergente</SelectItem>
                    <SelectItem value="duplicata_suspeita">duplicata_suspeita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
