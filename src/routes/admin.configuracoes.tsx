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
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["prestacao_template", "alertas_destinatarios"]);
      const t = data?.find((d) => d.chave === "prestacao_template")?.valor as any;
      const a = data?.find((d) => d.chave === "alertas_destinatarios")?.valor as any;
      setTemplateId(t?.template_id ?? "");
      setEmails((a?.emails ?? []).join(", "));
      setLoading(false);
    })();
  }, []);

  const salvar = async () => {
    setSalvando(true);
    const id = extrairSheetId(templateId); // mesmo padrão de extração funciona p/ Docs
    const lista = emails.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const { error: e1 } = await supabase
      .from("configuracoes")
      .upsert({ chave: "prestacao_template", valor: { template_id: id } });
    const { error: e2 } = await supabase
      .from("configuracoes")
      .upsert({ chave: "alertas_destinatarios", valor: { emails: lista } });
    setSalvando(false);
    if (e1 || e2) return toast.error("Erro ao salvar");
    toast.success("Configurações salvas");
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Template do Google Docs para Prestação de Contas e destinatários de alertas.
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

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
