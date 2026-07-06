import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle2, ExternalLink, Plus, HelpCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { type Modelo, type TipoModelo, TIPO_LABEL, extrairSheetId } from "@/lib/modelos";
import { useActiveOrg } from "@/hooks/use-active-org";

export const Route = createFileRoute("/_authenticated/admin/modelos")({ component: ModelosPage });


const TIPOS: TipoModelo[] = ["orcamento", "mapa", "controle_bancario"];

const DEFAULTS_PARAMS: Record<TipoModelo, { aba: string; linhaPrimeiroItem1: number; qtdLinhasExistentes: number; linhaTotais1: number; colCount: number }> = {
  orcamento: { aba: "Orcamento", linhaPrimeiroItem1: 14, qtdLinhasExistentes: 4, linhaTotais1: 18, colCount: 11 },
  mapa: { aba: "MapaComparativo", linhaPrimeiroItem1: 19, qtdLinhasExistentes: 2, linhaTotais1: 22, colCount: 12 },
  controle_bancario: { aba: "Controle", linhaPrimeiroItem1: 2, qtdLinhasExistentes: 10, linhaTotais1: 13, colCount: 8 },
};

function ModelosPage() {
  const { activeOrgId } = useActiveOrg();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Partial<Modelo> | null>(null);

  const carregar = async () => {
    if (!activeOrgId) { setModelos([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("modelos_planilha")
      .select("*")
      .eq("organization_id", activeOrgId)
      .order("tipo", { ascending: true })
      .order("criado_em", { ascending: false });
    if (error) toast.error("Erro ao carregar modelos");
    setModelos((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { void carregar(); }, [activeOrgId]);


  const novo = (tipo: TipoModelo) => {
    const d = DEFAULTS_PARAMS[tipo];
    setEditando({
      tipo,
      nome: `${TIPO_LABEL[tipo]} — novo modelo`,
      template_id: "",
      aba: d.aba,
      params: {
        linhaPrimeiroItem1: d.linhaPrimeiroItem1,
        qtdLinhasExistentes: d.qtdLinhasExistentes,
        linhaTotais1: d.linhaTotais1,
        colCount: d.colCount,
      },
      ativo: false,
    });
  };

  const salvar = async () => {
    if (!editando) return;
    if (!activeOrgId) return toast.error("Selecione uma organização");
    const id = extrairSheetId(editando.template_id || "");
    if (!id) return toast.error("Informe o ID ou URL da planilha");
    if (!editando.nome?.trim()) return toast.error("Informe um nome");
    const payload = {
      tipo: editando.tipo!,
      nome: editando.nome.trim(),
      template_id: id,
      aba: editando.aba || "",
      params: editando.params || {},
      ativo: editando.ativo ?? false,
    };
    const q = editando.id
      ? supabase.from("modelos_planilha").update(payload).eq("id", editando.id)
      : supabase.from("modelos_planilha").insert({ ...payload, organization_id: activeOrgId });
    const { error } = await q;
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Modelo salvo");
    setEditando(null);
    void carregar();
  };


  const excluir = async (m: Modelo) => {
    if (!confirm(`Excluir "${m.nome}"?`)) return;
    const { error } = await supabase.from("modelos_planilha").delete().eq("id", m.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Excluído");
    void carregar();
  };

  const ativar = async (m: Modelo) => {
    if (!activeOrgId) return toast.error("Selecione uma organização");
    // desativa todos do mesmo tipo na org, depois ativa este
    const { error: e1 } = await supabase
      .from("modelos_planilha")
      .update({ ativo: false })
      .eq("organization_id", activeOrgId)
      .eq("tipo", m.tipo);
    if (e1) return toast.error("Erro: " + e1.message);
    const { error: e2 } = await supabase
      .from("modelos_planilha")
      .update({ ativo: true })
      .eq("id", m.id);
    if (e2) return toast.error("Erro: " + e2.message);
    toast.success("Modelo ativado");
    void carregar();
  };


  return (
    <div className="p-8 space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl uppercase">Modelos de planilha</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cole o ID ou URL do Google Sheets do modelo e ajuste os parâmetros de layout. O modelo
            marcado como <strong>ativo</strong> será usado nas próximas gerações; sem ativo, usa o
            padrão do sistema.
          </p>
        </div>
        <Link
          to="/admin/modelos/ajuda"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <HelpCircle className="h-4 w-4" />
          Como preparar meus modelos
        </Link>
      </header>

      {TIPOS.map((tipo) => {
        const lista = modelos.filter((m) => m.tipo === tipo);
        return (
          <section key={tipo} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
                {TIPO_LABEL[tipo]}
              </h2>
              <Button size="sm" variant="outline" onClick={() => novo(tipo)}>
                <Plus className="h-4 w-4 mr-1" /> Novo modelo
              </Button>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : lista.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Nenhum modelo cadastrado — o sistema usará o template padrão.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lista.map((m) => (
                  <Card key={m.id} className={m.ativo ? "border-foreground" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between gap-2">
                        <span className="truncate">{m.nome}</span>
                        {m.ativo && <Badge variant="default" className="shrink-0">Ativo</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {m.template_id}
                      </div>
                      <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        <span>aba: <strong className="text-foreground">{m.aba || "—"}</strong></span>
                        <span>1º item: <strong className="text-foreground">L{m.params?.linhaPrimeiroItem1 ?? "?"}</strong></span>
                        <span>linhas: <strong className="text-foreground">{m.params?.qtdLinhasExistentes ?? "?"}</strong></span>
                        <span>totais: <strong className="text-foreground">L{m.params?.linhaTotais1 ?? "?"}</strong></span>
                        <span>cols: <strong className="text-foreground">{m.params?.colCount ?? "?"}</strong></span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {!m.ativo && (
                          <Button size="sm" variant="default" onClick={() => ativar(m)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Ativar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setEditando(m)}>
                          <Pencil className="h-4 w-4 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${m.template_id}/edit`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => excluir(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando?.id ? "Editar modelo" : "Novo modelo"}
            </DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-3">
              <Field label="Tipo">
                <Select
                  value={editando.tipo}
                  onValueChange={(v) => setEditando({ ...editando, tipo: v as TipoModelo })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nome do modelo">
                <Input
                  value={editando.nome ?? ""}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                />
              </Field>
              <Field label="ID ou URL do Google Sheets">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                  value={editando.template_id ?? ""}
                  onChange={(e) => setEditando({ ...editando, template_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pode colar a URL completa — extraímos o ID automaticamente.
                </p>
              </Field>
              <Field label="Nome da aba">
                <Input
                  value={editando.aba ?? ""}
                  onChange={(e) => setEditando({ ...editando, aba: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Linha do 1º item">
                  <Input
                    type="number"
                    value={editando.params?.linhaPrimeiroItem1 ?? ""}
                    onChange={(e) => setEditando({
                      ...editando,
                      params: { ...editando.params, linhaPrimeiroItem1: Number(e.target.value) },
                    })}
                  />
                </Field>
                <Field label="Qtd linhas existentes">
                  <Input
                    type="number"
                    value={editando.params?.qtdLinhasExistentes ?? ""}
                    onChange={(e) => setEditando({
                      ...editando,
                      params: { ...editando.params, qtdLinhasExistentes: Number(e.target.value) },
                    })}
                  />
                </Field>
                <Field label="Linha de totais">
                  <Input
                    type="number"
                    value={editando.params?.linhaTotais1 ?? ""}
                    onChange={(e) => setEditando({
                      ...editando,
                      params: { ...editando.params, linhaTotais1: Number(e.target.value) },
                    })}
                  />
                </Field>
                <Field label="Nº de colunas">
                  <Input
                    type="number"
                    value={editando.params?.colCount ?? ""}
                    onChange={(e) => setEditando({
                      ...editando,
                      params: { ...editando.params, colCount: Number(e.target.value) },
                    })}
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
