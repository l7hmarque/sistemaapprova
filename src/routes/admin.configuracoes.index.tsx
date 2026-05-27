import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Trash2 } from "lucide-react";
import { extrairSheetId } from "@/lib/modelos";

export const Route = createFileRoute("/admin/configuracoes/")({ component: ConfigGeralPage });

function ConfigGeralPage() {
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
      .upsert({ chave: "prestacao_template", valor: { template_id: id } }, { onConflict: "chave" });
    const { error: e2 } = await supabase
      .from("configuracoes")
      .upsert({ chave: "alertas_destinatarios", valor: { emails: lista } }, { onConflict: "chave" });
    const { error: e3 } = await supabase
      .from("configuracoes")
      .upsert(
        {
          chave: "auto_vinculo",
          valor: {
            valor_centavos: Math.max(0, Math.min(10000, Math.round(valorCentavos))),
            janela_dias: Math.max(0, Math.min(60, Math.round(janelaDias))),
          },
        },
        { onConflict: "chave" }
      );
    setSalvando(false);
    if (e1 || e2 || e3) return toast.error("Erro ao salvar");
    toast.success("Configurações salvas");
  };

  const limparLocalStorage = () => {
    const chaves = Object.keys(localStorage).filter((k) => k.startsWith("synsit:"));
    chaves.forEach((k) => localStorage.removeItem(k));
    toast.success(`${chaves.length} item(ns) do app removido(s) do localStorage`);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <Card data-tour-anchor="wizard-card" className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">Configuração inicial guiada</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wizard de 5 passos para conectar Drive, Docs e Sheets. Otimizado para quem não é da área técnica.
            </p>
          </div>
          <Link to="/admin/setup">
            <Button>
              Iniciar wizard <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Auto-vínculo de documentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-destructive">Zona de perigo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Remove todos os dados salvos localmente no navegador (tours, wizard, preferências). Não afeta dados no servidor.
          </p>
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={limparLocalStorage}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar dados locais
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
