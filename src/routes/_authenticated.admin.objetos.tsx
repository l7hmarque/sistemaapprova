import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { listarObjetos, salvarObjeto, removerObjeto } from "@/lib/objetos.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/admin/objetos")({
  head: () => ({ meta: [{ title: "Objetos de cotação — Approva" }] }),
  component: ObjetosPage,
});

type Objeto = { id: string; descricao: string; unidade_padrao: string | null; categoria: string | null; uso_count: number };

function ObjetosPage() {
  const fetchAll = useServerFn(listarObjetos);
  const salvar = useServerFn(salvarObjeto);
  const remover = useServerFn(removerObjeto);
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["objetos-cotacao", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fetchAll({ data: { organization_id: activeOrgId! } }),
  });

  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Partial<Objeto> | null>(null);

  const mutSave = useMutation({
    mutationFn: (input: Partial<Objeto>) => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return salvar({
        data: {
          id: input.id,
          organization_id: activeOrgId,
          descricao: input.descricao!,
          unidade_padrao: input.unidade_padrao,
          categoria: input.categoria,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objetos-cotacao"] });
      toast.success("Objeto salvo");
      setEditing(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => {
      if (!activeOrgId) throw new Error("Selecione uma organização");
      return remover({ data: { id, organization_id: activeOrgId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objetos-cotacao"] });
      toast.success("Removido");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = (data ?? []).filter((o) =>
    busca ? (o.descricao + " " + (o.categoria ?? "")).toLowerCase().includes(busca.toLowerCase()) : true,
  );

  return (
    <AdminShell title="Objetos de cotação" subtitle="Catálogo de itens reutilizáveis em cotações">
      <div className="flex gap-3 items-center mb-4">
        <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ descricao: "" })} className="gap-2 ml-auto">
              <Plus className="h-4 w-4" /> Novo objeto
            </Button>
          </DialogTrigger>
          {editing && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing.id ? "Editar objeto" : "Novo objeto"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Descrição</Label>
                  <Input value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Unidade padrão</Label>
                    <Input value={editing.unidade_padrao ?? ""} onChange={(e) => setEditing({ ...editing, unidade_padrao: e.target.value })} placeholder="UN, KG, CX..." />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Input value={editing.categoria ?? ""} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={() => mutSave.mutate(editing)} disabled={!editing.descricao?.trim() || mutSave.isPending}>
                  Salvar
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
            <p className="p-6 text-sm text-muted-foreground">Nenhum objeto cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {lista.map((o) => (
                <li key={o.id} className="flex items-center gap-3 p-3">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{o.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.unidade_padrao && <span>{o.unidade_padrao} · </span>}
                      {o.categoria && <span>{o.categoria} · </span>}
                      usado {o.uso_count}x
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover?")) mutDel.mutate(o.id); }}>
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
