import { createFileRoute } from "@tanstack/react-router";
import { useActiveOrg } from "@/hooks/use-active-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TIPOS_TRANSFERENCIA } from "@/lib/sit/catalogos";

export const Route = createFileRoute("/_authenticated/admin/configuracoes/organizacao")({
  component: OrgPage,
});

function OrgPage() {
  const { activeOrg, activeRole, loading } = useActiveOrg();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Termo SIT
  const [cnpjConcedente, setCnpjConcedente] = useState("");
  const [tpTransferencia, setTpTransferencia] = useState<string>("9");
  const [nrInterno, setNrInterno] = useState("");
  const [anoTransferencia, setAnoTransferencia] = useState<string>(String(new Date().getFullYear()));
  const [salvandoTermo, setSalvandoTermo] = useState(false);

  useEffect(() => {
    if (activeOrg) setNome(activeOrg.nome);
  }, [activeOrg]);

  useEffect(() => {
    if (!activeOrg) return;
    supabase
      .from("organizations")
      .select("cnpj")
      .eq("id", activeOrg.id)
      .single()
      .then(({ data }) => setCnpj(data?.cnpj ?? ""));

    supabase
      .from("configuracoes")
      .select("valor")
      .eq("organization_id", activeOrg.id)
      .eq("chave", "sit_termo")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data?.valor ?? {}) as Record<string, unknown>;
        if (typeof v.nrCNPJConcedente === "string") setCnpjConcedente(v.nrCNPJConcedente);
        if (typeof v.tpTransferencia === "number") setTpTransferencia(String(v.tpTransferencia));
        if (typeof v.nrInternoConcedente === "string") setNrInterno(v.nrInternoConcedente);
        if (typeof v.anoTransferencia === "number") setAnoTransferencia(String(v.anoTransferencia));
      });
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

  const salvarTermo = async () => {
    const cnpjLimpo = cnpjConcedente.replace(/\D/g, "");
    const ano = Number(anoTransferencia);
    if (cnpjLimpo.length !== 14) return toast.error("CNPJ concedente deve ter 14 dígitos");
    if (!Number.isFinite(ano) || ano < 2000 || ano > 2100) return toast.error("Ano inválido");
    if (!nrInterno.trim()) return toast.error("Informe o nº interno do concedente");
    setSalvandoTermo(true);
    const payload = {
      organization_id: activeOrg.id,
      chave: "sit_termo",
      valor: {
        nrCNPJConcedente: cnpjLimpo,
        tpTransferencia: Number(tpTransferencia),
        nrInternoConcedente: nrInterno.trim().slice(0, 20),
        anoTransferencia: ano,
      },
    };
    const { error } = await supabase
      .from("configuracoes")
      .upsert(payload, { onConflict: "organization_id,chave" });
    setSalvandoTermo(false);
    if (error) return toast.error(error.message);
    toast.success("Termo salvo");
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
          <CardTitle className="text-sm uppercase tracking-wide">Dados do Termo (SIT/TCE-PR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Necessário para gerar o arquivo Despesa.txt do SIT. Esses dados são repetidos em todas as linhas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">CNPJ concedente</Label>
              <Input
                value={cnpjConcedente}
                onChange={(e) => setCnpjConcedente(e.target.value)}
                disabled={!podeEditar}
                placeholder="00000000000000"
                maxLength={18}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de transferência</Label>
              <Select value={tpTransferencia} onValueChange={setTpTransferencia} disabled={!podeEditar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_TRANSFERENCIA.map((t) => (
                    <SelectItem key={t.codigo} value={String(t.codigo)}>
                      {t.codigo} — {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nº interno concedente (≤20)</Label>
              <Input
                value={nrInterno}
                onChange={(e) => setNrInterno(e.target.value.slice(0, 20))}
                disabled={!podeEditar}
                maxLength={20}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ano transferência</Label>
              <Input
                value={anoTransferencia}
                onChange={(e) => setAnoTransferencia(e.target.value.replace(/\D/g, "").slice(0, 4))}
                disabled={!podeEditar}
                maxLength={4}
                placeholder="2026"
              />
            </div>
          </div>
          {podeEditar && (
            <div className="flex justify-end pt-2">
              <Button onClick={salvarTermo} disabled={salvandoTermo}>
                {salvandoTermo ? "Salvando…" : "Salvar Termo"}
              </Button>
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
