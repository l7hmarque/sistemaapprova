import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { extrairSheetId } from "@/lib/modelos";

export const Route = createFileRoute("/admin/configuracoes")({ component: ConfigPage });

function ConfigPage() {
  const [templateId, setTemplateId] = useState("");
  const [emails, setEmails] = useState("");
  const [valorCentavos, setValorCentavos] = useState(50);
  const [janelaDias, setJanelaDias] = useState(3);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["prestacao_template", "alertas_destinatarios", "auto_vinculo"]);
      const t = data?.find((d) => d.chave === "prestacao_template")?.valor as { template_id?: string } | undefined;
      const a = data?.find((d) => d.chave === "alertas_destinatarios")?.valor as { emails?: string[] } | undefined;
      const av = data?.find((d) => d.chave === "auto_vinculo")?.valor as { valor_centavos?: number; janela_dias?: number } | undefined;
      setTemplateId(t?.template_id ?? "");
      setEmails((a?.emails ?? []).join(", "));
      if (typeof av?.valor_centavos === "number") setValorCentavos(av.valor_centavos);
      if (typeof av?.janela_dias === "number") setJanelaDias(av.janela_dias);
      setLoading(false);
    })();
  }, []);

  const salvar = async () => {
    setSalvando(true);
    const id = extrairSheetId(templateId);
    const lista = emails.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const { error: e1 } = await supabase
      .from("configuracoes")
      .upsert({ chave: "prestacao_template", valor: { template_id: id } });
    const { error: e2 } = await supabase
      .from("configuracoes")
      .upsert({ chave: "alertas_destinatarios", valor: { emails: lista } });
    const { error: e3 } = await supabase
      .from("configuracoes")
      .upsert({
        chave: "auto_vinculo",
        valor: {
          valor_centavos: Math.max(0, Math.min(10000, Math.round(valorCentavos))),
          janela_dias: Math.max(0, Math.min(60, Math.round(janelaDias))),
        },
      });
    setSalvando(false);
    if (e1 || e2 || e3) return toast.error("Erro ao salvar");
    toast.success("Configurações salvas");
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Template do Google Docs, destinatários de alertas e tolerância de auto-vínculo.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Template — Prestação de Contas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">ID ou URL do Google Docs</Label>
            <Input
              placeholder="https://docs.google.com/document/d/…/edit"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pode colar a URL completa do documento — extraímos o ID.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Destinatários de alertas (e-mail)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">E-mails separados por vírgula</Label>
          <Textarea
            rows={3}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="financeiro@org.org, presidencia@org.org"
          />
          <p className="text-xs text-muted-foreground">
            Estes endereços receberão notificações de prazos próximos (configuração de envio na Fase 4).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Auto-vínculo de documentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Usado em <strong>/admin/captura</strong> para casar documento → evento do mês.
            Doc casa quando CNPJ confere e os limites abaixo são respeitados.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tolerância de valor (centavos)
              </Label>
              <Input
                type="number" min={0} max={10000} step={1}
                value={valorCentavos}
                onChange={(e) => setValorCentavos(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hoje: ±R$ {(valorCentavos / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Janela de datas (dias)
              </Label>
              <Input
                type="number" min={0} max={60} step={1}
                value={janelaDias}
                onChange={(e) => setJanelaDias(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hoje: ±{janelaDias} dia(s) do vencimento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
