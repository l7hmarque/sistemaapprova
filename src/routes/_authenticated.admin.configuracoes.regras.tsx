import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import type { RegraDespesa } from "@/lib/sit/regrasDespesa";
import {
  listarRegrasDespesa,
  criarRegraDespesa,
  atualizarRegraDespesa,
  excluirRegraDespesa,
} from "@/lib/regras-despesa.functions";
import {
  TIPOS_DOC_DESPESA,
  TIPOS_DOC_PAGAMENTO,
  MODALIDADES_COMPRA,
  CATEGORIA_TO_TPDESPESA,
  CATEGORIAS,
} from "@/lib/sit/catalogos";

export const Route = createFileRoute("/_authenticated/admin/configuracoes/regras")({
  component: RegrasPage,
});

type FormState = Omit<RegraDespesa, "id"> & { id?: string };

const EMPTY: FormState = {
  nome: "",
  prioridade: 100,
  ativo: true,
  match_tp_despesa: null,
  match_tp_documento: null,
  match_favorecido_regex: null,
  set_cd_modalidade: null,
  set_tp_documento_pagamento: null,
  set_tp_documento_favorecido: null,
  set_nr_documento_favorecido: null,
  set_nm_favorecido: null,
  set_tp_despesa: null,
};

function tpDespesaLabel(codigo: number | null): string {
  if (codigo == null) return "—";
  const entry = Object.entries(CATEGORIA_TO_TPDESPESA).find(([, c]) => c === codigo);
  if (!entry) return String(codigo);
  const cat = CATEGORIAS.find((c) => c.codigo === entry[0]);
  return `${entry[0]} — ${cat?.nome ?? codigo}`;
}
function tpDocLabel(codigo: number | null): string {
  if (codigo == null) return "—";
  const t = TIPOS_DOC_DESPESA.find((x) => x.codigo === codigo);
  return t ? `${t.codigo} — ${t.nome}` : String(codigo);
}
function modalidadeLabel(codigo: number | null): string {
  if (codigo == null) return "—";
  const m = MODALIDADES_COMPRA.find((x) => x.codigo === codigo);
  return m ? `${m.codigo} — ${m.nome}` : String(codigo);
}
function pagamentoLabel(codigo: number | null): string {
  if (codigo == null) return "—";
  const p = TIPOS_DOC_PAGAMENTO.find((x) => x.codigo === codigo);
  return p ? `${p.codigo} — ${p.nome}` : String(codigo);
}

function RegrasPage() {
  const { activeOrgId } = useActiveOrg();
  const [regras, setRegras] = useState<RegraDespesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const listar = useServerFn(listarRegrasDespesa);
  const criar = useServerFn(criarRegraDespesa);
  const atualizar = useServerFn(atualizarRegraDespesa);
  const excluir = useServerFn(excluirRegraDespesa);

  async function recarregar() {
    if (!activeOrgId) return setRegras([]);
    setLoading(true);
    try {
      const r = await listar({ data: { organizationId: activeOrgId } });
      setRegras(r);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar regras");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  function abrirNova() {
    setForm({ ...EMPTY });
    setOpen(true);
  }
  function abrirEdit(r: RegraDespesa) {
    setForm({ ...r });
    setOpen(true);
  }

  async function salvar() {
    if (!activeOrgId) return toast.error("Selecione uma organização");
    if (!form.nome.trim()) return toast.error("Informe um nome");
    const hasMatch =
      form.match_tp_despesa != null ||
      form.match_tp_documento != null ||
      !!form.match_favorecido_regex;
    if (!hasMatch) return toast.error("Defina pelo menos um critério em 'Quando'");
    const regra = {
      nome: form.nome.trim().slice(0, 120),
      prioridade: form.prioridade,
      ativo: form.ativo,
      match_tp_despesa: form.match_tp_despesa,
      match_tp_documento: form.match_tp_documento,
      match_favorecido_regex: form.match_favorecido_regex || null,
      set_cd_modalidade: form.set_cd_modalidade,
      set_tp_documento_pagamento: form.set_tp_documento_pagamento,
      set_tp_documento_favorecido: form.set_tp_documento_favorecido,
      set_nr_documento_favorecido: form.set_nr_documento_favorecido || null,
      set_nm_favorecido: form.set_nm_favorecido || null,
      set_tp_despesa: form.set_tp_despesa,
    };
    try {
      if (form.id) {
        await atualizar({ data: { id: form.id, regra } });
      } else {
        await criar({ data: { organizationId: activeOrgId, regra } });
      }
      toast.success("Regra salva");
      setOpen(false);
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    }
  }

  async function remover(r: RegraDespesa) {
    if (!confirm(`Excluir a regra "${r.nome}"?`)) return;
    try {
      await excluir({ data: { id: r.id } });
      toast.success("Regra excluída");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir");
    }
  }

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-right" />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Regras de despesa</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Automações que preenchem campos SIT quando um evento novo bate no
              critério. Só preenchem campos vazios — nunca sobrescrevem valores
              já definidos manualmente.
            </p>
          </div>
          <Button onClick={abrirNova}>
            <Plus className="w-4 h-4 mr-2" /> Nova regra
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : regras.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma regra cadastrada.
            </p>
          ) : (
            <div className="space-y-2">
              {regras.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-4 border rounded-md p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.nome}</span>
                      <Badge variant="outline">prio {r.prioridade}</Badge>
                      {!r.ativo && <Badge variant="secondary">inativa</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Quando:</span>{" "}
                        {[
                          r.match_tp_despesa != null &&
                            `REO ${tpDespesaLabel(r.match_tp_despesa)}`,
                          r.match_tp_documento != null &&
                            `Doc ${tpDocLabel(r.match_tp_documento)}`,
                          r.match_favorecido_regex &&
                            `Favorecido ~ /${r.match_favorecido_regex}/i`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                      <div>
                        <span className="font-medium">Aplicar:</span>{" "}
                        {[
                          r.set_tp_despesa != null &&
                            `REO=${tpDespesaLabel(r.set_tp_despesa)}`,
                          r.set_cd_modalidade != null &&
                            `Modalidade=${modalidadeLabel(r.set_cd_modalidade)}`,
                          r.set_tp_documento_pagamento != null &&
                            `Pagto=${pagamentoLabel(r.set_tp_documento_pagamento)}`,
                          r.set_tp_documento_favorecido &&
                            `TipoDoc=${r.set_tp_documento_favorecido}`,
                          r.set_nr_documento_favorecido &&
                            `NºDoc=${r.set_nr_documento_favorecido}`,
                          r.set_nm_favorecido && `Nome=${r.set_nm_favorecido}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEdit(r)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remover(r)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar regra" : "Nova regra"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                maxLength={120}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Input
                type="number"
                value={form.prioridade}
                onChange={(e) =>
                  setForm({
                    ...form,
                    prioridade: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label>Ativa</Label>
                <div className="pt-2">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2 mt-2 border-t pt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Quando (pelo menos um critério)
              </div>
            </div>
            <div>
              <Label>Tipo despesa (REO)</Label>
              <Select
                value={form.match_tp_despesa != null ? String(form.match_tp_despesa) : "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    match_tp_despesa: v === "none" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— qualquer —</SelectItem>
                  {CATEGORIAS.map((c) => {
                    const cod = CATEGORIA_TO_TPDESPESA[c.codigo];
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
                value={form.match_tp_documento != null ? String(form.match_tp_documento) : "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    match_tp_documento: v === "none" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— qualquer —</SelectItem>
                  {TIPOS_DOC_DESPESA.map((t) => (
                    <SelectItem key={t.codigo} value={String(t.codigo)}>
                      {t.codigo} — {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Regex sobre nome do favorecido (opcional)</Label>
              <Input
                placeholder="ex.: SANEPAR|COPEL"
                value={form.match_favorecido_regex ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    match_favorecido_regex: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="col-span-2 mt-2 border-t pt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Aplicar (só preenche campos vazios)
              </div>
            </div>
            <div>
              <Label>Forçar REO</Label>
              <Select
                value={form.set_tp_despesa != null ? String(form.set_tp_despesa) : "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    set_tp_despesa: v === "none" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— não alterar —</SelectItem>
                  {CATEGORIAS.map((c) => {
                    const cod = CATEGORIA_TO_TPDESPESA[c.codigo];
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
              <Label>Modalidade compra</Label>
              <Select
                value={form.set_cd_modalidade != null ? String(form.set_cd_modalidade) : "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    set_cd_modalidade: v === "none" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— não alterar —</SelectItem>
                  {MODALIDADES_COMPRA.map((m) => (
                    <SelectItem key={m.codigo} value={String(m.codigo)}>
                      {m.codigo} — {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo doc pagamento</Label>
              <Select
                value={form.set_tp_documento_pagamento != null ? String(form.set_tp_documento_pagamento) : "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    set_tp_documento_pagamento: v === "none" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— não alterar —</SelectItem>
                  {TIPOS_DOC_PAGAMENTO.map((t) => (
                    <SelectItem key={t.codigo} value={String(t.codigo)}>
                      {t.codigo} — {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo doc favorecido</Label>
              <Select
                value={form.set_tp_documento_favorecido ?? "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    set_tp_documento_favorecido: v === "none" ? null : v,
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— não alterar —</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="EXT">EXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº doc favorecido (override)</Label>
              <Input
                value={form.set_nr_documento_favorecido ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    set_nr_documento_favorecido: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Nome do favorecido (override)</Label>
              <Input
                maxLength={250}
                value={form.set_nm_favorecido ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    set_nm_favorecido: e.target.value || null,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
