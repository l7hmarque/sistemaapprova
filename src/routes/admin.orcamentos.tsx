import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FolderOpen, FileText, ArrowRight } from "lucide-react";
import { listarCotacoes, criarCotacao, removerCotacao, listarPresets, criarCotacaoDePreset } from "@/lib/cotacoes.functions";

export const Route = createFileRoute("/admin/orcamentos")({
  head: () => ({ meta: [{ title: "Cotações — SynSIT" }] }),
  component: CotacoesPage,
});

type Item = { descricao: string; qtd: number; unidade: string };

const STATUS_LABEL: Record<string, string> = {
  coletando: "Coletando",
  pronto_para_mapa: "Pronto p/ mapa",
  finalizado: "Finalizado",
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CotacoesPage() {
  const fetchAll = useServerFn(listarCotacoes);
  const fetchPresets = useServerFn(listarPresets);
  const criar = useServerFn(criarCotacao);
  const remover = useServerFn(removerCotacao);
  const criarDePreset = useServerFn(criarCotacaoDePreset);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["cotacoes"], queryFn: () => fetchAll() });
  const { data: presets } = useQuery({ queryKey: ["cotacao-presets"], queryFn: () => fetchPresets() });

  const [novo, setNovo] = useState<{ open: boolean; objeto: string; termo: string; mes: string; itens: Item[] } | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);

  const mutCreate = useMutation({
    mutationFn: () =>
      criar({
        data: {
          objeto: novo!.objeto,
          termo: novo!.termo,
          mes_referencia: novo!.mes,
          itens: novo!.itens.filter((i) => i.descricao.trim()),
        },
      }),
    onSuccess: (cot: any) => {
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
      toast.success("Cotação criada");
      setNovo(null);
      window.location.href = `/admin/cotacoes/${cot.id}`;
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
      toast.success("Cotação removida");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDePreset = useMutation({
    mutationFn: (preset_id: string) => criarDePreset({ data: { preset_id, mes_referencia: mesAtual() } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["cotacoes"] });
      toast.success("Cotação criada do modelo");
      setPresetOpen(false);
      window.location.href = `/admin/cotacoes/${r.cotacao.id}`;
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = (data ?? []) as any[];

  return (
    <AdminShell title="Cotações" subtitle="Coleta de orçamentos por fornecedor e geração de mapa comparativo">
      <div className="flex gap-2 mb-4">
        <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FolderOpen className="h-4 w-4" /> Usar modelo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Carregar modelo de cotação</DialogTitle>
            </DialogHeader>
            <ul className="divide-y max-h-80 overflow-auto">
              {(presets ?? []).length === 0 && (
                <li className="py-6 text-sm text-muted-foreground text-center">Nenhum modelo salvo ainda.</li>
              )}
              {(presets ?? []).map((p: any) => (
                <li key={p.id} className="py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">{p.itens.length} itens</div>
                  </div>
                  <Button size="sm" onClick={() => mutDePreset.mutate(p.id)} disabled={mutDePreset.isPending}>
                    Usar
                  </Button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>

        <Dialog open={novo !== null} onOpenChange={(o) => !o && setNovo(null)}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 ml-auto"
              onClick={() => setNovo({ open: true, objeto: "", termo: "", mes: mesAtual(), itens: [{ descricao: "", qtd: 1, unidade: "UN" }] })}
            >
              <Plus className="h-4 w-4" /> Nova cotação
            </Button>
          </DialogTrigger>
          {novo && (
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova cotação</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
                  <div>
                    <Label>Objeto *</Label>
                    <Input value={novo.objeto} onChange={(e) => setNovo({ ...novo, objeto: e.target.value })} />
                  </div>
                  <div>
                    <Label>Termo</Label>
                    <Input value={novo.termo} onChange={(e) => setNovo({ ...novo, termo: e.target.value })} />
                  </div>
                  <div>
                    <Label>Mês (AAAA-MM)</Label>
                    <Input value={novo.mes} onChange={(e) => setNovo({ ...novo, mes: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Itens</Label>
                  <div className="space-y-2 mt-1">
                    {novo.itens.map((it, i) => (
                      <div key={i} className="grid grid-cols-[3fr_1fr_1fr_auto] gap-2">
                        <Input placeholder="Descrição" value={it.descricao} onChange={(e) => {
                          const arr = [...novo.itens]; arr[i] = { ...it, descricao: e.target.value }; setNovo({ ...novo, itens: arr });
                        }} />
                        <Input type="number" min={0} placeholder="Qtd" value={it.qtd} onChange={(e) => {
                          const arr = [...novo.itens]; arr[i] = { ...it, qtd: Number(e.target.value) || 0 }; setNovo({ ...novo, itens: arr });
                        }} />
                        <Input placeholder="UN" value={it.unidade} onChange={(e) => {
                          const arr = [...novo.itens]; arr[i] = { ...it, unidade: e.target.value }; setNovo({ ...novo, itens: arr });
                        }} />
                        <Button variant="ghost" size="sm" onClick={() => setNovo({ ...novo, itens: novo.itens.filter((_, x) => x !== i) })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setNovo({ ...novo, itens: [...novo.itens, { descricao: "", qtd: 1, unidade: "UN" }] })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovo(null)}>Cancelar</Button>
                <Button onClick={() => mutCreate.mutate()} disabled={!novo.objeto.trim() || novo.itens.filter((i) => i.descricao.trim()).length === 0 || mutCreate.isPending}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : lista.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma cotação criada.</p>
          ) : (
            <ul className="divide-y">
              {lista.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.objeto}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.termo ? `${c.termo} · ` : ""}
                      {c.mes_referencia ?? ""} · {(c.itens as any[])?.length ?? 0} itens
                    </div>
                  </div>
                  <Badge variant="outline">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  <Link to="/admin/cotacoes/$id" params={{ id: c.id }}>
                    <Button size="sm" variant="ghost" className="gap-1">
                      Abrir <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover cotação?")) mutDel.mutate(c.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
