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
  Send, Trophy, Zap, ArrowRightCircle,
} from "lucide-react";
import {
  obterCotacao, gerarOrcamentoParaCotacao, removerOrcamentoCotacao, gerarMapaDaCotacao, salvarPreset,
  rankingCotacao, gerarMapaAutomatico, definirVencedor, gerarEventoDaCotacao,
} from "@/lib/cotacoes.functions";
import { listarFornecedores } from "@/lib/fornecedores.functions";
import { criarConvite, listarConvitesDaCotacao, removerConvite, reenviarConvite } from "@/lib/convites.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/_authenticated/admin/cotacoes/$id")({
  head: () => ({ meta: [{ title: "Cotação — Approva" }] }),
  component: CotacaoDetalhePage,
});

type Item = { descricao: string; qtd: number; unidade: string };

function CotacaoDetalhePage() {
  const { id } = Route.useParams();
  const { activeOrgId } = useActiveOrg();
  const fetchOne = useServerFn(obterCotacao);
  const fetchForn = useServerFn(listarFornecedores);
  const gerarOrc = useServerFn(gerarOrcamentoParaCotacao);
  const removerOrc = useServerFn(removerOrcamentoCotacao);
  const gerarMapa = useServerFn(gerarMapaDaCotacao);
  const gerarMapaAuto = useServerFn(gerarMapaAutomatico);
  const fetchRanking = useServerFn(rankingCotacao);
  const setVencedor = useServerFn(definirVencedor);
  const gerarEvento = useServerFn(gerarEventoDaCotacao);
  const savePreset = useServerFn(salvarPreset);
  const novoConvite = useServerFn(criarConvite);
  const fetchConvites = useServerFn(listarConvitesDaCotacao);
  const delConvite = useServerFn(removerConvite);
  const reenvConvite = useServerFn(reenviarConvite);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cotacao", id, activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fetchOne({ data: { id, organization_id: activeOrgId! } }),
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fetchForn({ data: { organization_id: activeOrgId! } }),
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
      if (!activeOrgId) throw new Error("Selecione uma organização");
      const f = (fornecedores ?? []).find((x: any) => x.id === addForn.fornecedor_id);
      if (!f) throw new Error("Selecione um fornecedor");
      return gerarOrc({
        data: {
          organization_id: activeOrgId,
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
    mutationFn: (orcId: string) => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return removerOrc({ data: { id: orcId, organization_id: activeOrgId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Orçamento removido");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutMapa = useMutation({
    mutationFn: () => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return gerarMapa({ data: { organization_id: activeOrgId, cotacao_id: id, orcamento_ids: mapaSel.ids as [string, string, string] } });
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Mapa comparativo gerado");
      setMapaSel({ open: false, ids: [] });
      window.open(r.url, "_blank");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutSavePreset = useMutation({
    mutationFn: () => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return savePreset({
        data: {
          organization_id: activeOrgId,
          nome: presetOpen.nome,
          objeto: cot?.objeto ?? null,
          termo: cot?.termo ?? null,
          itens: itens.map((i) => ({ descricao: i.descricao, qtd: i.qtd, unidade: i.unidade })),
          fornecedores_sugeridos: orcs.map((o) => {
            const f = (o.dados as any)?.fornecedor;
            return { razao: f?.razao ?? "", cnpj: f?.cnpj ?? "" };
          }).filter((f) => f.cnpj),
        },
      });
    },
    onSuccess: () => {
      toast.success("Modelo salvo");
      setPresetOpen({ open: false, nome: "" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const orcamentosPreenchidos = orcs.filter((o) => o.tipo === "cotacao" && o.status === "preenchido");
  const mapa = orcs.find((o) => o.tipo === "mapa_comparativo");
  const vencedorId = cot?.orcamento_vencedor_id as string | null | undefined;
  const eventoGeradoId = cot?.evento_financeiro_id as string | null | undefined;

  const { data: ranking } = useQuery({
    queryKey: ["cotacao-ranking", id, activeOrgId, orcs.length],
    enabled: !!activeOrgId && orcamentosPreenchidos.length > 0,
    queryFn: () => fetchRanking({ data: { id, organization_id: activeOrgId! } }),
  });

  const mutMapaAuto = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      const r = await gerarMapaAuto({ data: { organization_id: activeOrgId, cotacao_id: id } });
      return gerarMapa({
        data: { organization_id: activeOrgId, cotacao_id: id, orcamento_ids: r.orcamento_ids },
      });
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Mapa gerado com os 3 menores preços");
      window.open(r.url, "_blank");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutVencedor = useMutation({
    mutationFn: (orcamento_id: string) => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return setVencedor({ data: { organization_id: activeOrgId, cotacao_id: id, orcamento_id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success("Vencedor definido");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutEvento = useMutation({
    mutationFn: () => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return gerarEvento({ data: { id, organization_id: activeOrgId } });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cotacao", id] });
      toast.success(r.ja_existia ? "Evento já existia — abrindo" : "Evento criado no financeiro");
      window.location.href = "/admin/painel";
    },
    onError: (e) => toast.error((e as Error).message),
  });

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

          {ranking && ranking.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Ranking de preços
                </CardTitle>
                {eventoGeradoId ? (
                  <Badge variant="secondary">Lançado no financeiro</Badge>
                ) : vencedorId ? (
                  <Button size="sm" onClick={() => mutEvento.mutate()} disabled={mutEvento.isPending} className="gap-1">
                    <ArrowRightCircle className="h-3.5 w-3.5" /> Lançar no financeiro
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y text-sm">
                  {ranking.map((r: any, idx: number) => {
                    const isWinner = r.id === vencedorId;
                    return (
                      <li key={r.id} className="flex items-center gap-3 p-3">
                        <div className={`w-6 text-center text-xs font-bold ${idx === 0 ? "text-primary" : "text-muted-foreground"}`}>{idx + 1}º</div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate flex items-center gap-2">
                            {r.razao || "—"}
                            {isWinner && <Badge className="text-[10px]">Vencedor</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">CNPJ {r.cnpj || "—"}</div>
                        </div>
                        <div className="font-medium">{Number(r.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                        {!isWinner && !eventoGeradoId && (
                          <Button size="sm" variant="ghost" onClick={() => mutVencedor.mutate(r.id)} disabled={mutVencedor.isPending}>
                            Definir vencedor
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
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
                Escolha automaticamente os 3 menores preços, ou selecione manualmente.
              </p>
              <Button
                className="w-full gap-1"
                disabled={orcamentosPreenchidos.length < 3 || mutMapaAuto.isPending}
                onClick={() => mutMapaAuto.mutate()}
              >
                <Zap className="h-3.5 w-3.5" />
                {orcamentosPreenchidos.length < 3
                  ? `${orcamentosPreenchidos.length}/3 preenchidos`
                  : mutMapaAuto.isPending ? "Gerando…" : "Gerar mapa (3 menores)"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={orcamentosPreenchidos.length < 3}
                onClick={() => setMapaSel({ open: true, ids: [] })}
              >
                Selecionar manualmente
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

          <ConvitesPanel
            cotacaoId={id}
            fornecedores={fornecedores ?? []}
            fetchConvites={fetchConvites}
            novoConvite={novoConvite}
            delConvite={delConvite}
            reenvConvite={reenvConvite}
          />

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

function ConvitesPanel({
  cotacaoId, fornecedores, fetchConvites, novoConvite, delConvite, reenvConvite,
}: {
  cotacaoId: string;
  fornecedores: any[];
  fetchConvites: (a: any) => Promise<any>;
  novoConvite: (a: any) => Promise<any>;
  delConvite: (a: any) => Promise<any>;
  reenvConvite: (a: any) => Promise<any>;
}) {
  const qc = useQueryClient();
  const { data: convites } = useQuery({
    queryKey: ["convites", cotacaoId],
    queryFn: () => fetchConvites({ data: { cotacao_id: cotacaoId } }),
  });
  const [open, setOpen] = useState(false);
  const [fornId, setFornId] = useState<string>("");

  const mut = useMutation({
    mutationFn: () => {
      const f = fornecedores.find((x) => x.id === fornId);
      if (!f) throw new Error("Selecione um fornecedor");
      return novoConvite({
        data: {
          cotacao_id: cotacaoId,
          fornecedor_id: f.id,
          razao_social: f.razao_social,
          cnpj: f.cnpj,
          email: f.email ?? "",
          telefone: f.telefone ?? "",
          representante_legal: f.representante_legal ?? "",
          cpf_representante: f.cpf_representante ?? "",
          endereco: f.endereco ?? "",
          validade_dias: 30,
        },
      });
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["convites", cotacaoId] });
      if (r?.email_enviado) toast.success("Convite criado e e-mail enviado");
      else toast.success(`Convite criado (${r?.email_motivo ?? "sem e-mail"})`);
      setOpen(false);
      setFornId("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => delConvite({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["convites", cotacaoId] }),
  });

  const mutReenv = useMutation({
    mutationFn: (id: string) => reenvConvite({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["convites", cotacaoId] });
      toast.success("E-mail reenviado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/cotacao/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Convites a fornecedores</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {(convites ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Crie um convite e envie o link para o fornecedor preencher.</p>
        ) : (
          <ul className="divide-y">
            {(convites ?? []).map((c: any) => (
              <li key={c.id} className="py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{c.razao_social}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.status}
                    {c.email ? ` · ${c.email}` : " · sem e-mail"}
                    {c.envios_count > 1 ? ` · ${c.envios_count} envios` : ""}
                  </div>
                </div>
                {c.email && c.status === "pendente" && (
                  <Button size="sm" variant="ghost" onClick={() => mutReenv.mutate(c.id)} disabled={mutReenv.isPending} title="Reenviar e-mail">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => copiarLink(c.token)} className="gap-1" title="Copiar link">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => mutDel.mutate(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo convite</DialogTitle></DialogHeader>
          <div>
            <Label>Fornecedor</Label>
            <select
              className="w-full border rounded h-9 px-2 text-sm bg-background"
              value={fornId}
              onChange={(e) => setFornId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.razao_social} — {f.cnpj}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => mut.mutate()} disabled={!fornId || mut.isPending}>Gerar link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
