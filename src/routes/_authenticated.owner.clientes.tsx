import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/owner/clientes")({ component: ClientesPage });

type Org = {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: "osc" | "escritorio";
  plano: string;
  status: "trial" | "ativo" | "suspenso" | "cancelado";
  trial_ate: string | null;
  criado_em: string;
};

function ClientesPage() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", tipo: "osc" as "osc" | "escritorio", plano: "essencial" });

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["owner-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, cnpj, tipo, plano, status, trial_ate, criado_em")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Org[];
    },
  });

  const criar = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    const { error } = await supabase.from("organizations").insert({
      nome: form.nome,
      cnpj: form.cnpj || null,
      tipo: form.tipo,
      plano: form.plano,
      status: "trial",
    });
    if (error) return toast.error(error.message);
    toast.success("Organização criada (trial 30 dias)");
    setNovoOpen(false);
    setForm({ nome: "", cnpj: "", tipo: "osc", plano: "essencial" });
    qc.invalidateQueries({ queryKey: ["owner-orgs"] });
  };

  const mudarStatus = async (org: Org, status: Org["status"]) => {
    const { error } = await supabase.from("organizations").update({ status }).eq("id", org.id);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`);
    qc.invalidateQueries({ queryKey: ["owner-orgs"] });
  };

  const mudarPlano = async (org: Org, plano: string) => {
    const { error } = await supabase.from("organizations").update({ plano }).eq("id", org.id);
    if (error) return toast.error(error.message);
    toast.success(`Plano: ${plano}`);
    qc.invalidateQueries({ queryKey: ["owner-orgs"] });
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Todas as organizações (OSCs e escritórios).</p>
        </div>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button>+ Nova organização</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova organização</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="osc">OSC</SelectItem>
                    <SelectItem value="escritorio">Escritório contábil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Plano</Label>
                <Select value={form.plano} onValueChange={(v) => setForm({ ...form, plano: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essencial">Essencial</SelectItem>
                    <SelectItem value="completo">Completo</SelectItem>
                    <SelectItem value="escritorio">Escritório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNovoOpen(false)}>Cancelar</Button>
              <Button onClick={criar}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">
            {orgs?.length ?? 0} organização(ões)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !orgs?.length ? (
            <div className="text-sm text-muted-foreground">Nenhuma organização ainda.</div>
          ) : (
            <div className="divide-y divide-border">
              {orgs.map((o) => (
                <div key={o.id} className="grid grid-cols-12 gap-3 items-center py-3">
                  <div className="col-span-4">
                    <Link to="/_authenticated/owner/clientes/$id" params={{ id: o.id }} className="font-medium hover:underline">
                      {o.nome}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {o.tipo === "escritorio" ? "Escritório" : "OSC"} · {o.cnpj || "—"}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <Select value={o.plano} onValueChange={(v) => mudarPlano(o, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="essencial">Essencial</SelectItem>
                        <SelectItem value="completo">Completo</SelectItem>
                        <SelectItem value="escritorio">Escritório</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select value={o.status} onValueChange={(v) => mudarStatus(o, v as Org["status"])}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 text-right">
                    <Badge variant={o.status === "ativo" ? "default" : "secondary"} className="uppercase text-[10px]">
                      {o.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
