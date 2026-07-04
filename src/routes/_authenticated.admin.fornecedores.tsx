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
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { listarFornecedores, salvarFornecedor, removerFornecedor } from "@/lib/fornecedores.functions";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/admin/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — Approva" }] }),
  component: FornecedoresPage,
});

type Fornecedor = {
  id: string;
  razao_social: string;
  cnpj: string;
  representante_legal: string | null;
  cpf_representante: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
};

function FornecedoresPage() {
  const fetchAll = useServerFn(listarFornecedores);
  const salvar = useServerFn(salvarFornecedor);
  const remover = useServerFn(removerFornecedor);
  const qc = useQueryClient();
  const { activeOrgId } = useActiveOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["fornecedores", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => fetchAll({ data: { organization_id: activeOrgId! } }),
  });

  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Partial<Fornecedor> | null>(null);

  const mutSave = useMutation({
    mutationFn: (f: Partial<Fornecedor>) =>
      salvar({
        data: {
          id: f.id,
          organization_id: activeOrgId ?? undefined,
          razao_social: f.razao_social!,
          cnpj: f.cnpj!,
          representante_legal: f.representante_legal,
          cpf_representante: f.cpf_representante,
          email: f.email,
          telefone: f.telefone,
          endereco: f.endereco,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor salvo");
      setEditing(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Removido");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = ((data ?? []) as Fornecedor[]).filter((f) =>
    busca ? (f.razao_social + " " + f.cnpj).toLowerCase().includes(busca.toLowerCase()) : true,
  );

  return (
    <AdminShell title="Fornecedores" subtitle="Cadastro de fornecedores para cotações">
      <div className="flex gap-3 items-center mb-4">
        <Input placeholder="Buscar por nome ou CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ razao_social: "", cnpj: "" })} className="gap-2 ml-auto">
              <Plus className="h-4 w-4" /> Novo fornecedor
            </Button>
          </DialogTrigger>
          {editing && (
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Razão social *</Label>
                  <Input value={editing.razao_social ?? ""} onChange={(e) => setEditing({ ...editing, razao_social: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CNPJ *</Label>
                    <Input value={editing.cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={editing.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Representante</Label>
                    <Input value={editing.representante_legal ?? ""} onChange={(e) => setEditing({ ...editing, representante_legal: e.target.value })} />
                  </div>
                  <div>
                    <Label>CPF do representante</Label>
                    <Input value={editing.cpf_representante ?? ""} onChange={(e) => setEditing({ ...editing, cpf_representante: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={editing.endereco ?? ""} onChange={(e) => setEditing({ ...editing, endereco: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button
                  onClick={() => mutSave.mutate(editing)}
                  disabled={!editing.razao_social?.trim() || !editing.cnpj?.trim() || mutSave.isPending}
                >
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
            <p className="p-6 text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {lista.map((f) => (
                <li key={f.id} className="flex items-center gap-3 p-3">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.razao_social}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      CNPJ {f.cnpj}
                      {f.representante_legal ? ` · ${f.representante_legal}` : ""}
                      {f.email ? ` · ${f.email}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover?")) mutDel.mutate(f.id); }}>
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
