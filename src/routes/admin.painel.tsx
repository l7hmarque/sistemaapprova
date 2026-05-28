import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Plus, Trash2, Pencil, FileWarning, FileCheck2, FileDown, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useServerFn } from "@tanstack/react-start";
import { gerarPrestacaoSnapshot } from "@/lib/prestacao-snapshot.functions";
import { useActiveOrg } from "@/hooks/use-active-org";
import { formatLinhaSIT, type DadosTermo } from "@/lib/sit/formatLinha";
import { encodeWin1252 } from "@/lib/sit/ansiEncode";
import {
  TIPOS_DOC_DESPESA, TIPOS_DOC_PAGAMENTO, MODALIDADES_COMPRA,
  CATEGORIAS as CATEGORIAS_REO, CATEGORIA_TO_TPDESPESA,
} from "@/lib/sit/catalogos";
import { pendenciasSIT } from "@/lib/sit/inferCaptura";

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
  data_emissao: string | null;
  origem: string;
  status_documental: string;
  metadata?: Record<string, unknown> | null;
  id_interno: string | null;
  tp_documento_despesa: number | null;
  tp_doc_fav: string | null;
  nr_doc_fav: string | null;
  nm_favorecido: string | null;
  nr_documento: string | null;
  cd_modalidade_compra: number | null;
  tp_documento_pagamento: number | null;
  nr_documento_pagamento: string | null;
  tp_despesa: number | null;
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
  // Strings locais para inputs numéricos (evita perder ponto decimal durante digitação)
  const [valorPrevStr, setValorPrevStr] = useState<string>("");
  const [valorEfetStr, setValorEfetStr] = useState<string>("");
  const [numeroDocStr, setNumeroDocStr] = useState<string>("");
  const [dataEmissaoStr, setDataEmissaoStr] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [fechando, setFechando] = useState(false);
  const fecharMes = useServerFn(gerarPrestacaoSnapshot);

  function parseNum(s: string): number | null {
    const t = s.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }


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

  const { activeOrgId } = useActiveOrg();

  async function recarregar() {
    if (!activeOrgId) { setEventos([]); return; }
    const { data, error } = await supabase
      .from("eventos_financeiros")
      .select("*")
      .eq("organization_id", activeOrgId)
      .eq("mes_referencia", mes)
      .order("data_vencimento", { ascending: true, nullsFirst: false });
    if (error) toast.error("Falha ao carregar eventos: " + error.message);
    else setEventos((data ?? []) as Evento[]);
  }

  useEffect(() => { void recarregar(); }, [mes, activeOrgId]);
  useEffect(() => {
    if (!activeOrgId) { setFornecedores([]); return; }
    (async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, razao_social, cnpj")
        .eq("organization_id", activeOrgId)
        .order("razao_social");
      setFornecedores((data ?? []) as Fornecedor[]);
    })();
  }, [activeOrgId]);

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
      data_emissao: null,
      origem: "manual",
      status_documental: "pendente",
      id_interno: null,
      tp_documento_despesa: null,
      tp_doc_fav: null,
      nr_doc_fav: null,
      nm_favorecido: null,
      nr_documento: null,
      cd_modalidade_compra: null,
      tp_documento_pagamento: null,
      nr_documento_pagamento: null,
      tp_despesa: null,
    });
    setValorPrevStr("");
    setValorEfetStr("");
    setNumeroDocStr("");
    setDataEmissaoStr("");
    setOpen(true);
  }

  function abrirEdit(e: Evento) {
    setEditing({ ...e });
    setValorPrevStr(e.valor_previsto != null ? String(e.valor_previsto) : "");
    setValorEfetStr(e.valor_efetivo != null ? String(e.valor_efetivo) : "");
    setNumeroDocStr(e.nr_documento ?? "");
    setDataEmissaoStr(e.data_emissao ?? "");
    setOpen(true);
  }

  async function salvar() {
    if (!editing) return;
    const descricaoLimpa = (editing.descricao ?? "").slice(0, 200);
    const payload = {
      mes_referencia: editing.mes_referencia,
      fornecedor_id: editing.fornecedor_id,
      categoria: editing.categoria,
      descricao: descricaoLimpa,
      valor_previsto: parseNum(valorPrevStr),
      valor_efetivo: parseNum(valorEfetStr),
      data_vencimento: editing.data_vencimento,
      data_pagamento: editing.data_pagamento,
      data_emissao: dataEmissaoStr || null,
      origem: editing.origem,
      status_documental: editing.status_documental,
      id_interno: editing.id_interno?.slice(0, 30) || null,
      nr_documento: numeroDocStr.trim() || null,
      tp_documento_despesa: editing.tp_documento_despesa,
      tp_doc_fav: editing.tp_doc_fav,
      nr_doc_fav: editing.nr_doc_fav?.replace(/\D/g, "") || null,
      nm_favorecido: editing.nm_favorecido,
      cd_modalidade_compra: editing.cd_modalidade_compra,
      tp_documento_pagamento: editing.tp_documento_pagamento,
      nr_documento_pagamento: editing.nr_documento_pagamento,
      tp_despesa: editing.tp_despesa,
      metadata: (editing.metadata ?? {}) as any,
    };
    if (editing.id) {
      const { error } = await supabase.from("eventos_financeiros").update(payload as any).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      if (!activeOrgId) return toast.error("Selecione uma organização ativa");
      const { error } = await supabase.from("eventos_financeiros").insert({ ...payload, organization_id: activeOrgId } as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Evento salvo");
    setOpen(false);
    setEditing(null);
    recarregar();
  }


  async function exportarSIT() {
    if (!activeOrgId) return toast.error("Selecione uma organização");
    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("organization_id", activeOrgId)
      .eq("chave", "sit_termo")
      .maybeSingle();
    const termo = cfg?.valor as DadosTermo | undefined;
    if (!termo?.nrCNPJConcedente || !termo?.tpTransferencia || !termo?.anoTransferencia) {
      return toast.error("Configure o Termo em Configurações > Organização");
    }
    const elegiveis: Evento[] = [];
    const pendencias: { desc: string; falta: string[] }[] = [];
    for (const e of filtrados) {
      const falta = pendenciasSIT(e);
      if (falta.length === 0) elegiveis.push(e);
      else pendencias.push({ desc: e.descricao || e.id_interno || "(sem descrição)", falta });
    }
    if (pendencias.length > 0) {
      const resumo = pendencias.slice(0, 5).map(p => `• ${p.desc}: ${p.falta.join(", ")}`).join("\n");
      const ok = confirm(
        `${pendencias.length} evento(s) sem todos os campos SIT (serão pulados):\n\n${resumo}${pendencias.length > 5 ? "\n…" : ""}\n\nGerar TXT com ${elegiveis.length} evento(s)?`,
      );
      if (!ok) return;
    }
    if (elegiveis.length === 0) return toast.error("Nenhum evento pronto para SIT neste mês");
    const linhas = elegiveis.map((e) =>
      formatLinhaSIT(termo, {
        tpDespesa: e.tp_despesa,
        tpDocumentoFavorecido: (e.tp_doc_fav as "CPF" | "CNPJ" | "EXT") ?? "CNPJ",
        nrDocumentoFavorecido: e.nr_doc_fav ?? "",
        nmFavorecido: e.nm_favorecido ?? "",
        tpDocumentoDespesa: e.tp_documento_despesa!,
        nrDocumentoDespesa: e.nr_documento ?? "",
        vlDocumentoDespesa: e.valor_efetivo ?? 0,
        dtDocumentoDespesa: e.data_emissao ?? e.data_vencimento ?? "",
        cdModalidadeCompra: e.cd_modalidade_compra!,
        tpDocumentoPagamento: e.tp_documento_pagamento!,
        nrDocumentoPagamento: e.nr_documento_pagamento ?? "",
        dtEmissaoPagamento: e.data_pagamento ?? "",
        dtDebito: e.data_pagamento ?? null,
        dsItemDespesa: e.descricao ?? "",
      }),
    );
    const conteudo = linhas.join("\r\n") + "\r\n";
    const bytes = encodeWin1252(conteudo);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "text/plain;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Despesa-${mes}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${elegiveis.length} linha(s) exportada(s)`);
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
          <Button onClick={exportarSIT} variant="outline">
            <FileDown className="mr-1 h-4 w-4" /> Exportar Despesa.txt
          </Button>
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm uppercase tracking-wide text-muted-foreground">
          <span>Eventos ({filtrados.length})</span>
          <span className="normal-case tracking-normal text-xs">
            {filtrados.filter((e) => pendenciasSIT(e).length === 0).length} de {filtrados.length} prontos para SIT
          </span>
        </div>

        {filtrados.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileWarning className="mx-auto mb-2 h-5 w-5 opacity-50" />
              Nenhum evento neste mês. Clique em "Novo evento" para começar.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((e) => {
            const forn = fornecedores.find((f) => f.id === e.fornecedor_id);
            const meta = (e.metadata ?? {}) as Record<string, unknown>;
            const cnpjMeta = typeof meta.cnpj_extraido === "string" ? meta.cnpj_extraido : null;
            const razaoMeta = typeof meta.razao_social_extraida === "string" ? meta.razao_social_extraida : null;
            const numeroMeta = typeof meta.numero_extraido === "string" ? meta.numero_extraido : null;
            const emissaoMeta = typeof meta.data_emissao === "string" ? meta.data_emissao : null;
            const motivoMeta = typeof meta.motivo_revisao === "string" ? meta.motivo_revisao : null;
            const dif = (Number(e.valor_efetivo) || 0) - (Number(e.valor_previsto) || 0);
            return (
              <Card key={e.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug break-words">
                        {e.descricao || "(sem descrição)"}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{e.categoria}</Badge>
                        <Badge variant={statusVariant(e.status_documental)} className="text-[10px]">
                          {e.status_documental}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{e.origem}</Badge>
                        {(() => {
                          const pend = pendenciasSIT(e);
                          if (pend.length === 0) return null;
                          return (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`${pend.length} pendência(s) SIT`}
                                    className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700"
                                    onClick={(ev) => ev.stopPropagation()}
                                  >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-medium">{pend.length}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-[11px] font-semibold mb-1">Pendências SIT:</div>
                                  <ul className="text-[11px] space-y-0.5">
                                    {pend.map((p) => (
                                      <li key={p}>• {p}</li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdit(e)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remover(e.id)} title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm flex-1">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fornecedor</div>
                    <div className="break-words">
                      {forn?.razao_social ?? razaoMeta ?? "—"}
                    </div>
                    {(forn?.cnpj || cnpjMeta) && (
                      <div className="text-xs text-muted-foreground">
                        CNPJ {forn?.cnpj ?? cnpjMeta}
                        {!forn && razaoMeta && " (não cadastrado)"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Emissão</div>
                      <div>{emissaoMeta ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencimento</div>
                      <div>{e.data_vencimento ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagamento</div>
                      <div>{e.data_pagamento ?? "—"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Previsto</div>
                      <div className="font-display text-base">
                        {e.valor_previsto != null ? `R$ ${Number(e.valor_previsto).toFixed(2)}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Efetivo</div>
                      <div className={`font-display text-base ${dif !== 0 && e.valor_efetivo != null ? "text-destructive" : ""}`}>
                        {e.valor_efetivo != null ? `R$ ${Number(e.valor_efetivo).toFixed(2)}` : "—"}
                      </div>
                    </div>
                  </div>

                  {numeroMeta && (
                    <div className="text-xs text-muted-foreground">
                      Nº doc: <span className="font-mono">{numeroMeta}</span>
                    </div>
                  )}
                  {motivoMeta && (
                    <div className="text-xs text-destructive">⚠ {motivoMeta}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>


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
                <Label className="flex justify-between">
                  <span>Descrição</span>
                  <span className="text-[10px] text-muted-foreground">
                    {(editing.descricao ?? "").length}/200
                  </span>
                </Label>
                <Input value={editing.descricao ?? ""} maxLength={200}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value.slice(0, 200) })} />
              </div>
              <div>
                <Label>Nº do documento</Label>
                <Input value={numeroDocStr} placeholder="—"
                  onChange={(e) => setNumeroDocStr(e.target.value)} />
              </div>
              <div>
                <Label>Data de emissão</Label>
                <Input type="date" value={dataEmissaoStr}
                  onChange={(e) => setDataEmissaoStr(e.target.value)} />
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
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={valorPrevStr}
                  onChange={(e) => setValorPrevStr(e.target.value)} />
              </div>
              <div>
                <Label>Valor efetivo</Label>
                <Input type="text" inputMode="decimal" placeholder="0,00"
                  value={valorEfetStr}
                  onChange={(e) => setValorEfetStr(e.target.value)} />
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

              <div className="col-span-2 mt-2 border-t pt-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Campos SIT (TCE-PR)
                </div>
              </div>
              <div>
                <Label>ID interno (≤30)</Label>
                <Input value={editing.id_interno ?? ""} maxLength={30}
                  onChange={(e) => setEditing({ ...editing, id_interno: e.target.value.slice(0, 30) || null })} />
              </div>
              <div>
                <Label>Tipo despesa (REO)</Label>
                <Select
                  value={editing.tp_despesa != null ? String(editing.tp_despesa) : "none"}
                  onValueChange={(v) => setEditing({ ...editing, tp_despesa: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem código —</SelectItem>
                    {CATEGORIAS_REO.map((c) => {
                      const cod = (CATEGORIA_TO_TPDESPESA as Record<string, number>)[c.codigo];
                      return cod ? (
                        <SelectItem key={c.codigo} value={String(cod)}>
                          {c.codigo} — {c.nome}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo doc despesa</Label>
                <Select
                  value={editing.tp_documento_despesa != null ? String(editing.tp_documento_despesa) : "none"}
                  onValueChange={(v) => setEditing({ ...editing, tp_documento_despesa: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {TIPOS_DOC_DESPESA.map((t) => (
                      <SelectItem key={t.codigo} value={String(t.codigo)}>
                        {t.codigo} — {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidade compra</Label>
                <Select
                  value={editing.cd_modalidade_compra != null ? String(editing.cd_modalidade_compra) : "none"}
                  onValueChange={(v) => setEditing({ ...editing, cd_modalidade_compra: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {MODALIDADES_COMPRA.map((m) => (
                      <SelectItem key={m.codigo} value={String(m.codigo)}>
                        {m.codigo} — {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo doc favorecido</Label>
                <Select
                  value={editing.tp_doc_fav ?? "none"}
                  onValueChange={(v) => setEditing({ ...editing, tp_doc_fav: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="EXT">EXT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº doc favorecido</Label>
                <Input value={editing.nr_doc_fav ?? ""}
                  onChange={(e) => setEditing({ ...editing, nr_doc_fav: e.target.value || null })} />
              </div>
              <div className="col-span-2">
                <Label>Nome favorecido (sobrepõe fornecedor no TXT)</Label>
                <Input value={editing.nm_favorecido ?? ""} maxLength={250}
                  onChange={(e) => setEditing({ ...editing, nm_favorecido: e.target.value.slice(0, 250) || null })} />
              </div>
              <div>
                <Label>Tipo doc pagamento</Label>
                <Select
                  value={editing.tp_documento_pagamento != null ? String(editing.tp_documento_pagamento) : "none"}
                  onValueChange={(v) => setEditing({ ...editing, tp_documento_pagamento: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {TIPOS_DOC_PAGAMENTO.map((t) => (
                      <SelectItem key={t.codigo} value={String(t.codigo)}>
                        {t.codigo} — {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº doc pagamento</Label>
                <Input value={editing.nr_documento_pagamento ?? ""} maxLength={15}
                  onChange={(e) => setEditing({ ...editing, nr_documento_pagamento: e.target.value.slice(0, 15) || null })} />
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
