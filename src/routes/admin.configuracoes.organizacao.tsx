import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes/organizacao")({
  component: OrgPage,
});

function OrgPage() {
  const { activeOrg, activeRole, loading } = useCurrentUser();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (activeOrg) {
      setNome(activeOrg.nome);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (!activeOrg) return;
    supabase
      .from("organizations")
      .select("cnpj")
      .eq("id", activeOrg.id)
      .single()
      .then(({ data }) => setCnpj(data?.cnpj ?? ""));
  }, [activeOrg]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!activeOrg) return <div className="text-sm text-muted-foreground">Sem organização vinculada.</div>;

  const podeEditar = activeRole === "owner" || activeRole === "admin";

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from("organizations")
      .update({ nome, cnpj: cnpj || null })
      .eq("id", activeOrg.id);
    setSalvando(false);
    if (error) return toast.error("Sem permissão para editar");
    toast.success("Dados atualizados");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Dados da organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={!podeEditar} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} disabled={!podeEditar} placeholder="00.000.000/0000-00" />
          </div>
          {podeEditar && (
            <div className="flex justify-end pt-2">
              <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Plano e status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano atual</span>
            <Badge variant="secondary" className="uppercase">{activeOrg.plano}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={activeOrg.status === "ativo" ? "default" : "secondary"} className="uppercase">
              {activeOrg.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <span>{activeOrg.tipo === "escritorio" ? "Escritório contábil" : "OSC"}</span>
          </div>
          {activeOrg.trial_ate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trial até</span>
              <span>{new Date(activeOrg.trial_ate).toLocaleDateString("pt-BR")}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-3 border-t border-border mt-3">
            Para alterar plano, falar com o time Approva pelo canal de suporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
