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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, ChevronDown, Sparkles } from "lucide-react";
import { listarFornecedores, salvarFornecedor, removerFornecedor } from "@/lib/fornecedores.functions";
import { useActiveOrg } from "@/hooks/use-active-org";
import { REGRAS_TEMPLATES, type RegrasSit } from "@/lib/sit/regrasSitSchema";
import {
  TIPOS_DOC_DESPESA, TIPOS_DOC_PAGAMENTO, MODALIDADES_COMPRA, CATEGORIAS,
} from "@/lib/sit/catalogos";

export const Route = createFileRoute("/_authenticated/admin/fornecedores")({
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
  regras_sit?: RegrasSit | null;
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
          regras_sit: (f.regras_sit ?? {}) as RegrasSit,
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

                <RegrasSitPanel
                  regras={(editing.regras_sit ?? {}) as RegrasSit}
                  onChange={(r) => setEditing({ ...editing, regras_sit: r })}
                />
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

// ---------------------------------------------------------------------------
// Regras SIT — painel colapsável dentro do formulário de fornecedor.
// Regras aqui têm precedência sobre a inferência automática na captura.
// ---------------------------------------------------------------------------

function RegrasSitPanel({
  regras,
  onChange,
}: {
  regras: RegrasSit;
  onChange: (r: RegrasSit) => void;
}) {
  const [open, setOpen] = useState(false);

  const set = (patch: Partial<RegrasSit>) => onChange({ ...regras, ...patch });
  const preencheu = Object.values(regras).some((v) => v !== null && v !== undefined && v !== "");

  const cat = CATEGORIAS.find((c) => c.codigo === regras.categoria_padrao);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-md">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          Regras SIT
          {preencheu && <Badge variant="secondary" className="ml-2">Configurado</Badge>}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Preenche automaticamente os campos SIT na captura
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-1 space-y-3 border-t">
        {/* Templates */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Aplicar template
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REGRAS_TEMPLATES.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onChange({ ...regras, ...t.regras })}
                title={t.descricao}
              >
                {t.label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive"
              onClick={() => onChange({})}
            >
              Limpar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de documento (despesa)</Label>
            <Select
              value={regras.tp_documento_despesa?.toString() ?? "none"}
              onValueChange={(v) => set({ tp_documento_despesa: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {TIPOS_DOC_DESPESA.map((t) => (
                  <SelectItem key={t.codigo} value={String(t.codigo)}>{t.codigo} – {t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Tipo de documento (pagamento)</Label>
            <Select
              value={regras.tp_documento_pagamento?.toString() ?? "none"}
              onValueChange={(v) => set({ tp_documento_pagamento: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {TIPOS_DOC_PAGAMENTO.map((t) => (
                  <SelectItem key={t.codigo} value={String(t.codigo)}>{t.codigo} – {t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Categoria padrão (REO)</Label>
            <Select
              value={regras.categoria_padrao ?? "none"}
              onValueChange={(v) => set({ categoria_padrao: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} – {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cat && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Código econômico oficial TCE-PR.
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Modalidade de compra</Label>
            <Select
              value={regras.cd_modalidade_compra?.toString() ?? "none"}
              onValueChange={(v) => set({ cd_modalidade_compra: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {MODALIDADES_COMPRA.map((m) => (
                  <SelectItem key={m.codigo} value={String(m.codigo)}>{m.codigo} – {m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Tipo doc. favorecido</Label>
            <Select
              value={regras.tp_doc_fav ?? "none"}
              onValueChange={(v) =>
                set({ tp_doc_fav: v === "none" ? null : (v as "CPF" | "CNPJ" | "EXT") })
              }
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="EXT">Estrangeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Sobrescrever nome do favorecido (opcional)</Label>
            <Input
              value={regras.nm_favorecido_override ?? ""}
              onChange={(e) => set({ nm_favorecido_override: e.target.value || null })}
              placeholder="Ex.: MINISTERIO DA FAZENDA - MATRIZ"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Observação</Label>
            <Textarea
              rows={2}
              value={regras.observacao ?? ""}
              onChange={(e) => set({ observacao: e.target.value || null })}
              placeholder="Nota interna sobre esse fornecedor..."
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
