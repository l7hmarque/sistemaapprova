import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExternalLink, Plus, Trash2, FileSpreadsheet, BarChart3, Save, FolderInput, Link2, Copy,
} from "lucide-react";
import {
  obterCotacao, gerarOrcamentoParaCotacao, removerOrcamentoCotacao, gerarMapaDaCotacao, salvarPreset,
} from "@/lib/cotacoes.functions";
import { listarFornecedores } from "@/lib/fornecedores.functions";
import { criarConvite, listarConvitesDaCotacao, removerConvite } from "@/lib/convites.functions";

export const Route = createFileRoute("/admin/cotacoes/$id")({
  head: () => ({ meta: [{ title: "Cotação — SynSIT" }] }),
  component: CotacaoDetalhePage,
});

type Item = { descricao: string; qtd: number; unidade: string };

function CotacaoDetalhePage() {
  const { id } = Route.useParams();
  const fetchOne = useServerFn(obterCotacao);
  const fetchForn = useServerFn(listarFornecedores);
  const gerarOrc = useServerFn(gerarOrcamentoParaCotacao);
  const removerOrc = useServerFn(removerOrcamentoCotacao);
  const gerarMapa = useServerFn(gerarMapaDaCotacao);
  const savePreset = useServerFn(salvarPreset);
  const novoConvite = useServerFn(criarConvite);
  const fetchConvites = useServerFn(listarConvitesDaCotacao);
  const delConvite = useServerFn(removerConvite);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cotacao", id],
    queryFn: () => fetchOne({ data: { id } }),
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => fetchForn(),
  });

  const [addForn, setAddForn] = useState<{ open: boolean; fornecedor_id: string | null; precos: number[] }>({
    open: false, fornecedor_id: null, precos: [],
  });
  const [mapaSel, setMapaSel] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [presetOpen, setPresetOpen] = useState<{ open: boolean; nome: string }>({ open: false, nome: "" });

  const cot = data?.cotacao as any;
  const itens = useMemo<Item[]>(() => (cot?.itens as Item[]) ?? [], [cot]);
  const orcs = (data?.orcamentos ?? []) as any[];

  const mutGerar = useMutation({
    mutationFn: () => {
      const f = (fornecedores ?? []).find((x: any) => x.id === addForn.fornecedor_id);
      if (!f) throw new Error("Selecione um fornecedor");
      return gerarOrc({
        data: {
          cotacao_id: id,
          fornecedor: {
            razao: f.razao_social,
            cnpj: f.cnpj,
            representante: f.representante_legal ?? "",
            cpf: f.cpf_representante ?? "",
          },
          precosUnitarios: addForn.precos,
          data: new Date().toLocaleDateString("pt-BR"),
          validadeDias: 30,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Orçamento gerado no Drive");
      setAddForn({ open: false, fornecedor_id: null, precos: [] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDel = useMutation({
    mutationFn: (orcId: string) => removerOrc({ data: { id: orcId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Orçamento removido");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutMapa = useMutation({
    mutationFn: () => gerarMapa({ data: { cotacao_id: id, orcamento_ids: mapaSel.ids as [string, string, string] } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Mapa comparativo gerado");
      setMapaSel({ open: false, ids: [] });
      window.open(r.url, "_blank");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutSavePreset = useMutation({
    mutationFn: () =>
      savePreset({
        data: {
          nome: presetOpen.nome,
          objeto: cot?.objeto ?? null,
          termo: cot?.termo ?? null,
          itens: itens.map((i) => ({ descricao: i.descricao, qtd: i.qtd, unidade: i.unidade })),
          fornecedores_sugeridos: orcs.map((o) => {
            const f = (o.dados as any)?.fornecedor;
            return { razao: f?.razao ?? "", cnpj: f?.cnpj ?? "" };
          }).filter((f) => f.cnpj),
        },
      }),
    onSuccess: () => {
      toast.success("Modelo salvo");
      setPresetOpen({ open: false, nome: "" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const orcamentosPreenchidos = orcs.filter((o) => o.tipo === "cotacao" && o.status === "preenchido");
  const mapa = orcs.find((o) => o.tipo === "mapa_comparativo");

  if (isLoading) {
    return <AdminShell title="Cotação"><p className="text-sm text-muted-foreground">Carregando...</p></AdminShell>;
  }
  if (!cot) {
    return <AdminShell title="Cotação"><p className="text-sm text-muted-foreground">Não encontrada.</p></AdminShell>;
  }

  return (
    <AdminShell title={cot.objeto} subtitle={`${cot.termo ?? ""} · ${cot.mes_referencia ?? ""}`} backTo="/admin/orcamentos">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Itens ({itens.length})</CardTitle>
              <Badge variant="outline">{cot.status}</Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Descrição</th>
                    <th className="py-2 pr-2">Qtd</th>
                    <th className="py-2 pr-2">UN</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-2">{it.descricao}</td>
                      <td className="py-2 pr-2">{it.qtd}</td>
                      <td className="py-2 pr-2">{it.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Orçamentos por fornecedor ({orcs.filter((o) => o.tipo === "cotacao").length})</CardTitle>
              <Button
                size="sm"
                onClick={() => setAddForn({ open: true, fornecedor_id: null, precos: itens.map(() => 0) })}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Lançar preços
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {orcs.filter((o) => o.tipo === "cotacao").length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum orçamento ainda. Clique em "Lançar preços" para começar.</p>
              ) : (
                <ul className="divide-y">
                  {orcs.filter((o) => o.tipo === "cotacao").map((o) => {
                    const f = (o.dados as any)?.fornecedor;
                    const total = ((o.dados as any)?.itens ?? []).reduce(
                      (a: number, i: any) => a + (Number(i.precoUnitario || 0) * Number(i.qtd || 0)), 0,
                    );
                    return (
                      <li key={o.id} className="flex items-center gap-3 p-3">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{f?.razao ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            CNPJ {f?.cnpj ?? "—"} · Total {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                        </div>
                        <Badge variant="outline">{o.status}</Badge>
                        {o.drive_file_url && (
                          <a href={o.drive_file_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" className="gap-1">
                              <ExternalLink className="h-3.5 w-3.5" /> Sheet
                            </Button>
                          </a>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover orçamento?")) mutDel.mutate(o.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Mapa comparativo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Selecione 3 orçamentos preenchidos para gerar o mapa no Drive.
              </p>
              <Button
                className="w-full"
                disabled={orcamentosPreenchidos.length < 3}
                onClick={() => setMapaSel({ open: true, ids: [] })}
              >
                {orcamentosPreenchidos.length < 3
                  ? `${orcamentosPreenchidos.length}/3 preenchidos`
                  : "Gerar mapa comparativo"}
              </Button>
              {mapa?.drive_file_url && (
                <a href={mapa.drive_file_url} target="_blank" rel="noreferrer" className="block">
                  <Button variant="outline" className="w-full gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir mapa gerado
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderInput className="h-4 w-4" /> Modelo (preset)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full gap-1" onClick={() => setPresetOpen({ open: true, nome: cot.objeto })}>
                <Save className="h-3.5 w-3.5" /> Salvar como modelo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Link to="/admin/fornecedores" className="text-xs text-primary hover:underline">
                Gerenciar fornecedores →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIALOG: lançar preços */}
      <Dialog open={addForn.open} onOpenChange={(o) => !o && setAddForn({ open: false, fornecedor_id: null, precos: [] })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lançar preços de um fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fornecedor</Label>
              <select
                className="w-full border rounded h-9 px-2 text-sm bg-background"
                value={addForn.fornecedor_id ?? ""}
                onChange={(e) => setAddForn({ ...addForn, fornecedor_id: e.target.value || null })}
              >
                <option value="">Selecione...</option>
                {(fornecedores ?? []).map((f: any) => (
                  <option key={f.id} value={f.id}>{f.razao_social} — {f.cnpj}</option>
                ))}
              </select>
              {(fornecedores ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum fornecedor cadastrado. <Link to="/admin/fornecedores" className="text-primary hover:underline">Cadastrar</Link>
                </p>
              )}
            </div>
            <div>
              <Label>Preços unitários</Label>
              <div className="space-y-1 mt-1 max-h-72 overflow-auto">
                {itens.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                    <div className="text-sm truncate">{i + 1}. {it.descricao} <span className="text-xs text-muted-foreground">({it.qtd} {it.unidade})</span></div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={addForn.precos[i] ?? 0}
                      onChange={(e) => {
                        const arr = [...addForn.precos];
                        arr[i] = Number(e.target.value) || 0;
                        setAddForn({ ...addForn, precos: arr });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddForn({ open: false, fornecedor_id: null, precos: [] })}>Cancelar</Button>
            <Button onClick={() => mutGerar.mutate()} disabled={!addForn.fornecedor_id || mutGerar.isPending}>
              {mutGerar.isPending ? "Gerando..." : "Gerar Sheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: gerar mapa */}
      <Dialog open={mapaSel.open} onOpenChange={(o) => !o && setMapaSel({ open: false, ids: [] })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione 3 orçamentos para o mapa</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 max-h-80 overflow-auto">
            {orcamentosPreenchidos.map((o) => {
              const f = (o.dados as any)?.fornecedor;
              const checked = mapaSel.ids.includes(o.id);
              return (
                <li key={o.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      if (v) {
                        if (mapaSel.ids.length >= 3) return;
                        setMapaSel({ ...mapaSel, ids: [...mapaSel.ids, o.id] });
                      } else {
                        setMapaSel({ ...mapaSel, ids: mapaSel.ids.filter((x) => x !== o.id) });
                      }
                    }}
                  />
                  <div className="text-sm">{f?.razao ?? "—"} <span className="text-xs text-muted-foreground">({f?.cnpj})</span></div>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapaSel({ open: false, ids: [] })}>Cancelar</Button>
            <Button onClick={() => mutMapa.mutate()} disabled={mapaSel.ids.length !== 3 || mutMapa.isPending}>
              Gerar mapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: salvar preset */}
      <Dialog open={presetOpen.open} onOpenChange={(o) => !o && setPresetOpen({ open: false, nome: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar cotação como modelo</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome do modelo</Label>
            <Input value={presetOpen.nome} onChange={(e) => setPresetOpen({ ...presetOpen, nome: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-2">
              O modelo guarda objeto, termo, itens e fornecedores. Ao reutilizar, datas e preços são zerados.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetOpen({ open: false, nome: "" })}>Cancelar</Button>
            <Button onClick={() => mutSavePreset.mutate()} disabled={!presetOpen.nome.trim() || mutSavePreset.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
