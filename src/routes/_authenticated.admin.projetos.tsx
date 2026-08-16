import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FolderKanban, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { listarProjetosComResumo, criarProjeto, atualizarProjeto, excluirProjeto } from "@/lib/projetos.functions";

export const Route = createFileRoute("/_authenticated/admin/projetos")({
  head: () => ({ meta: [{ title: "Projetos/Termos — Approva" }] }),
  component: ProjetosPage,
});

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

function moeda(n: number) {
  return `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProjetosPage() {
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrg();
  const fetchAll = useServerFn(listarProjetosComResumo);
  const criar = useServerFn(criarProjeto);
  const atualizar = useServerFn(atualizarProjeto);
  const remover = useServerFn(excluirProjeto);

  const { data, isLoading } = useQuery({
    queryKey: ["projetos", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fetchAll({ data: { organization_id: activeOrgId! } }),
  });

  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Partial<Record<string, any>> | null>(null);

  const mutSave = useMutation({
    mutationFn: async (p: any) => {
      const payload = {
        organization_id: activeOrgId!,
        nome: p.nome,
        numero_termo: p.numero_termo || undefined,
        orgao_concedente: p.orgao_concedente || undefined,
        objeto: p.objeto || undefined,
        valor_total: p.valor_total ? Number(p.valor_total) : undefined,
        vigencia_inicio: p.vigencia_inicio || undefined,
        vigencia_fim: p.vigencia_fim || undefined,
        status: p.status || "ativo",
      };
      if (p.id) {
        return atualizar({ data: { id: p.id, ...payload } });
      }
      return criar({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projetos"] });
      toast.success("Projeto salvo");
      setEditing(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projetos"] });
      toast.success("Projeto removido");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = ((data ?? []) as any[]).filter((p) =>
    busca ? (p.nome + " " + p.numero_termo).toLowerCase().includes(busca.toLowerCase()) : true,
  );

  const form = editing ?? {};

  return (
    <AdminShell title="Projetos / Termos" subtitle="Cadastre termos, convênios e acompanhe execução orçamentária.">
      <div className="flex gap-3 items-center mb-4">
        <Input
          placeholder="Buscar por nome ou número do termo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ nome: "", status: "ativo" })} className="gap-2 ml-auto">
              <Plus className="h-4 w-4" /> Novo projeto
            </Button>
          </DialogTrigger>
          {editing && (
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar projeto" : "Novo projeto"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome do projeto/termo *</Label>
                  <Input
                    value={form.nome ?? ""}
                    onChange={(e) => setEditing({ ...form, nome: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Número do termo/convenio</Label>
                    <Input
                      value={form.numero_termo ?? ""}
                      onChange={(e) => setEditing({ ...form, numero_termo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Órgão concedente</Label>
                    <Input
                      value={form.orgao_concedente ?? ""}
                      onChange={(e) => setEditing({ ...form, orgao_concedente: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Objeto</Label>
                  <Textarea
                    value={form.objeto ?? ""}
                    onChange={(e) => setEditing({ ...form, objeto: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Valor total aprovado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.valor_total ?? ""}
                      onChange={(e) => setEditing({ ...form, valor_total: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Vigência início</Label>
                    <Input
                      type="date"
                      value={form.vigencia_inicio ?? ""}
                      onChange={(e) => setEditing({ ...form, vigencia_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Vigência fim</Label>
                    <Input
                      type="date"
                      value={form.vigencia_fim ?? ""}
                      onChange={(e) => setEditing({ ...form, vigencia_fim: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status ?? "ativo"}
                    onValueChange={(v) => setEditing({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="encerrado">Encerrado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => mutSave.mutate(form)}
                  disabled={!form.nome || mutSave.isPending}
                >
                  {mutSave.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lista.map((p) => (
          <Card key={p.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                    {p.nome}
                  </CardTitle>
                  {p.numero_termo && (
                    <p className="text-xs text-muted-foreground truncate">{p.numero_termo}</p>
                  )}
                </div>
                <Badge variant={p.status === "ativo" ? "default" : "secondary"}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Aprovado</span>
                </div>
                <div className="text-right font-medium">{moeda(p.valor_total)}</div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-muted-foreground">Executado</span>
                </div>
                <div className="text-right font-medium">{moeda(p.totalExecutado)}</div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Saldo</span>
                </div>
                <div className="text-right font-medium">{moeda(p.saldo)}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() =>
                    setEditing({
                      id: p.id,
                      nome: p.nome,
                      numero_termo: p.numero_termo ?? "",
                      orgao_concedente: p.orgao_concedente ?? "",
                      objeto: p.objeto ?? "",
                      valor_total: p.valor_total ?? "",
                      vigencia_inicio: p.vigencia_inicio ?? "",
                      vigencia_fim: p.vigencia_fim ?? "",
                      status: p.status,
                    })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => confirm(`Remover ${p.nome}?`) && mutDel.mutate(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && lista.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum projeto cadastrado. Clique em "Novo projeto" para começar.
        </div>
      )}
    </AdminShell>
  );
}
