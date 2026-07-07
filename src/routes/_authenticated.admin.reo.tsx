import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Landmark, Download, Plus, Trash2, Save } from "lucide-react";
import {
  carregarReo, listarNaturezas,
  listarPlanoAplicacao, salvarLinhaPlano, removerLinhaPlano,
  listarRepasses, salvarRepasse, removerRepasse,
  salvarMovimento, gerarReoPdf,
} from "@/lib/reo.functions";

export const Route = createFileRoute("/_authenticated/admin/reo")({ component: ReoPage });

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function moeda(n: number) {
  return `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReoPage() {
  const [mes, setMes] = useState<string>(mesAtual());
  const [vigencia, setVigencia] = useState<string>(`${mes.slice(0, 4)}-01-01`);
  const qc = useQueryClient();

  const fnReo = useServerFn(carregarReo);
  const fnNat = useServerFn(listarNaturezas);
  const fnPlano = useServerFn(listarPlanoAplicacao);
  const fnSavePlano = useServerFn(salvarLinhaPlano);
  const fnDelPlano = useServerFn(removerLinhaPlano);
  const fnReps = useServerFn(listarRepasses);
  const fnSaveRep = useServerFn(salvarRepasse);
  const fnDelRep = useServerFn(removerRepasse);
  const fnSaveMov = useServerFn(salvarMovimento);
  const fnPdf = useServerFn(gerarReoPdf);

  const reoQ = useQuery({ queryKey: ["reo", mes], queryFn: () => fnReo({ data: { mes } }) });
  const natQ = useQuery({ queryKey: ["reo-nat"], queryFn: () => fnNat(), staleTime: 300_000 });
  const planoQ = useQuery({
    queryKey: ["reo-plano", vigencia],
    queryFn: () => fnPlano({ data: { vigenciaInicio: vigencia } }),
  });
  const repsQ = useQuery({ queryKey: ["reo-reps", mes], queryFn: () => fnReps({ data: { mes } }) });

  const [mov, setMov] = useState({ saldo_anterior: "", rendimentos: "", estornos_extra: "", observacao: "" });
  useMemo(() => {
    const m = reoQ.data?.movimento;
    if (m) setMov({
      saldo_anterior: String(m.saldo_anterior ?? 0),
      rendimentos: String(m.rendimentos ?? 0),
      estornos_extra: String(m.estornos_extra ?? 0),
      observacao: m.observacao ?? "",
    });
  }, [reoQ.data?.mes]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["reo"] });
    qc.invalidateQueries({ queryKey: ["reo-plano"] });
    qc.invalidateQueries({ queryKey: ["reo-reps"] });
  };

  const salvarMov = async () => {
    try {
      await fnSaveMov({
        data: {
          mes_referencia: mes,
          saldo_anterior: Number(mov.saldo_anterior) || 0,
          rendimentos: Number(mov.rendimentos) || 0,
          estornos_extra: Number(mov.estornos_extra) || 0,
          observacao: mov.observacao || null,
        },
      });
      toast.success("Movimento salvo");
      invalidateAll();
    } catch (e: any) { toast.error(e?.message || "Falha"); }
  };

  const baixarPdf = async () => {
    try {
      toast.loading("Gerando REO…", { id: "reo-pdf" });
      const r = await fnPdf({ data: { mes } });
      const bin = atob(r.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(`REO gerado — ${r.totalPaginas} pág. · ${moeda(r.totalDespesas)}`, { id: "reo-pdf" });
    } catch (e: any) { toast.error(e?.message || "Falha ao gerar", { id: "reo-pdf" }); }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase flex items-center gap-2">
            <Landmark className="h-7 w-7" /> REO Mensal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Relatório de Execução do Objeto — Execução Financeira (Lei 13.019/2014, art. 66, II).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Mês</Label>
            <Input value={mes} onChange={(e) => setMes(e.target.value)} placeholder="AAAA-MM" className="w-32" />
          </div>
          <Button onClick={baixarPdf}><Download className="h-4 w-4 mr-2" /> Gerar PDF</Button>
        </div>
      </header>

      {/* 2.3 Resumo */}
      <Card>
        <CardHeader><CardTitle className="text-base">2.3 Resumo financeiro do mês</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Saldo anterior</Label><Input value={mov.saldo_anterior} onChange={(e) => setMov({ ...mov, saldo_anterior: e.target.value })} /></div>
          <div><Label>Rendimentos</Label><Input value={mov.rendimentos} onChange={(e) => setMov({ ...mov, rendimentos: e.target.value })} /></div>
          <div><Label>Estornos extras (fora dos eventos)</Label><Input value={mov.estornos_extra} onChange={(e) => setMov({ ...mov, estornos_extra: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Observação</Label><Textarea value={mov.observacao} onChange={(e) => setMov({ ...mov, observacao: e.target.value })} rows={2} /></div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-4 pt-2 border-t">
            <Badge variant="secondary">Transferido: {moeda(reoQ.data?.movimento.valor_transferido || 0)}</Badge>
            <Badge variant="secondary">Executado: {moeda(reoQ.data?.movimento.valor_executado || 0)}</Badge>
            <Badge>Saldo p/ próximo mês: {moeda(reoQ.data?.movimento.saldo_proximo || 0)}</Badge>
            <div className="flex-1" />
            <Button size="sm" onClick={salvarMov}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
          </div>
        </CardContent>
      </Card>

      {/* 2.1 Repasses */}
      <Card>
        <CardHeader><CardTitle className="text-base flex justify-between">2.1 Valores transferidos <BotaoAddRepasse mes={mes} fn={fnSaveRep} onSaved={invalidateAll} /></CardTitle></CardHeader>
        <CardContent>
          {!repsQ.data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum repasse cadastrado neste mês.</p>
          ) : (
            <ul className="divide-y divide-border">
              {repsQ.data.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">Parcela {r.numero_parcela}</span> · {moeda(Number(r.valor))} · {r.data_recebimento}
                    {r.convenio && <span className="text-muted-foreground"> · {r.convenio}</span>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={async () => { await fnDelRep({ data: { id: r.id } }); invalidateAll(); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 2.2 Despesas */}
      <Card>
        <CardHeader><CardTitle className="text-base">2.2 Despesas efetuadas no mês ({reoQ.data?.eventos.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!reoQ.data?.eventos.length ? (
            <p className="text-sm text-muted-foreground">Sem despesas com pagamento neste mês.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {reoQ.data.eventos.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="text-muted-foreground mr-2">#{e.id_interno}</span>
                      {e.nm_favorecido || e.descricao}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.natureza_despesa_codigo ? (
                        <Badge variant="outline" className="text-[10px]">{e.natureza_despesa_codigo}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">sem natureza</Badge>
                      )}
                    </div>
                  </div>
                  <div className="font-medium">{moeda(Number(e.valor_efetivo))}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Plano + 2.4 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex flex-wrap items-center gap-3 justify-between">
            <span>Plano de aplicação & 2.4 Saldo por categoria</span>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">Vigência (início)</Label>
                <Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className="w-40" />
              </div>
              <BotaoAddPlano vigencia={vigencia} naturezas={natQ.data ?? []} fn={fnSavePlano} onSaved={invalidateAll} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!planoQ.data?.length ? (
            <p className="text-sm text-muted-foreground">Cadastre o plano de aplicação da vigência para ver o item 2.4.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1.5">Código</th>
                    <th className="text-left px-2 py-1.5">Descrição</th>
                    <th className="text-right px-2 py-1.5">Previsto</th>
                    <th className="text-right px-2 py-1.5">Gasto (ano)</th>
                    <th className="text-right px-2 py-1.5">Estornado</th>
                    <th className="text-right px-2 py-1.5">Disponível</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {planoQ.data.map((p: any) => {
                    const linha = reoQ.data?.linhas24.find((l: any) => l.codigo === p.natureza_codigo);
                    const nat = (natQ.data ?? []).find((n) => n.codigo === p.natureza_codigo);
                    const disp = linha?.disponivel ?? Number(p.valor_previsto);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-2 py-1.5 font-mono text-xs">{p.natureza_codigo}</td>
                        <td className="px-2 py-1.5">{nat?.descricao ?? ""}</td>
                        <td className="px-2 py-1.5 text-right">{moeda(Number(p.valor_previsto))}</td>
                        <td className="px-2 py-1.5 text-right">{moeda(linha?.gasto ?? 0)}</td>
                        <td className="px-2 py-1.5 text-right">{moeda(linha?.estornado ?? 0)}</td>
                        <td className={`px-2 py-1.5 text-right ${disp < 0 ? "text-destructive font-medium" : ""}`}>{moeda(disp)}</td>
                        <td className="px-2">
                          <Button size="sm" variant="ghost" onClick={async () => { await fnDelPlano({ data: { id: p.id } }); invalidateAll(); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {reoQ.data && reoQ.data.semNaturezaGasto > 0 && (
            <p className="text-xs text-destructive">
              Atenção: {moeda(reoQ.data.semNaturezaGasto)} em despesas do ano ainda sem natureza classificada — edite nas despesas do painel financeiro.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BotaoAddRepasse({ mes, fn, onSaved }: { mes: string; fn: any; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const add = async () => {
    const parcela = Number(prompt("Número da parcela?") || "0");
    const valor = Number((prompt("Valor (ex: 12345.67)") || "0").replace(",", "."));
    const dt = prompt("Data de recebimento (AAAA-MM-DD)") || "";
    if (!parcela || !valor || !dt) return;
    setLoading(true);
    try {
      await fn({ data: { mes_referencia: mes, numero_parcela: parcela, valor, data_recebimento: dt } });
      toast.success("Repasse adicionado"); onSaved();
    } catch (e: any) { toast.error(e?.message || "Falha"); }
    finally { setLoading(false); }
  };
  return <Button size="sm" variant="outline" onClick={add} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}</Button>;
}

function BotaoAddPlano({ vigencia, naturezas, fn, onSaved }: { vigencia: string; naturezas: Array<{ codigo: string; descricao: string }>; fn: any; onSaved: () => void }) {
  const [cod, setCod] = useState("");
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add natureza</Button>;
  const add = async () => {
    if (!cod || !val) return;
    setLoading(true);
    try {
      const [ano] = vigencia.split("-");
      await fn({
        data: {
          vigencia_inicio: vigencia,
          vigencia_fim: `${ano}-12-31`,
          natureza_codigo: cod,
          valor_previsto: Number(val.replace(",", ".")),
        },
      });
      toast.success("Adicionado"); setCod(""); setVal(""); setOpen(false); onSaved();
    } catch (e: any) { toast.error(e?.message || "Falha"); }
    finally { setLoading(false); }
  };
  return (
    <div className="flex items-end gap-2">
      <div>
        <Label className="text-xs">Natureza</Label>
        <Select value={cod} onValueChange={setCod}>
          <SelectTrigger className="w-64"><SelectValue placeholder="código…" /></SelectTrigger>
          <SelectContent>
            {naturezas.map((n) => <SelectItem key={n.codigo} value={n.codigo}>{n.codigo} · {n.descricao}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Previsto</Label>
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="0,00" className="w-32" />
      </div>
      <Button size="sm" onClick={add} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>×</Button>
    </div>
  );
}
