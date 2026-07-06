import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  FolderPlus,
  Info,
  Loader2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { validarDocs, validarSheets } from "@/lib/setup-wizard.functions";
import { garantirEstruturaDrive } from "@/lib/arquivos.functions";

export const Route = createFileRoute("/_authenticated/admin/setup")({ component: WizardPage });

const SUBPASTAS = ["Orçamentos", "Cotações", "Prestações", "Documentos"] as const;

type FileInfo = { id: string; name: string } | null;
type DriveFolders = { rootFolderId: string; subfolders: Record<string, string> } | null;

function WizardPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  const [drive, setDrive] = useState<DriveFolders>(null);
  const [creatingStructure, setCreatingStructure] = useState(false);

  const [docsUrl, setDocsUrl] = useState("");
  const [docs, setDocs] = useState<FileInfo>(null);
  const [valDocsLoading, setValDocsLoading] = useState(false);

  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheets, setSheets] = useState<FileInfo>(null);
  const [valSheetsLoading, setValSheetsLoading] = useState(false);

  const fnSetupDrive = useServerFn(garantirEstruturaDrive);
  const fnValidarDocs = useServerFn(validarDocs);
  const fnValidarSheets = useServerFn(validarSheets);

  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", uid)
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();
      const oid = mem?.organization_id ?? null;
      setOrgId(oid);
      if (!oid) { setLoading(false); return; }
      const { data } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .eq("organization_id", oid)
        .in("chave", ["prestacao_template", "painel_template"]);
      const presta = data?.find((d) => d.chave === "prestacao_template")?.valor as
        | { template_id?: string; nome?: string }
        | undefined;
      const painel = data?.find((d) => d.chave === "painel_template")?.valor as
        | { template_id?: string; nome?: string }
        | undefined;
      if (presta?.template_id) setDocs({ id: presta.template_id, name: presta.nome ?? "Prestação de Contas" });
      if (painel?.template_id) setSheets({ id: painel.template_id, name: painel.nome ?? "Painel Financeiro" });
      setLoading(false);
    })();
  }, []);

  const salvar = async (chave: string, valor: Record<string, unknown>) => {
    if (!orgId) { toast.error("Organização não encontrada"); return false; }
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ organization_id: orgId, chave, valor } as any, { onConflict: "organization_id,chave" });
    if (error) toast.error("Erro ao salvar: " + error.message);
    return !error;
  };


  const criarEstrutura = async () => {
    setCreatingStructure(true);
    try {
      const r = await fnSetupDrive();
      setDrive(r);
      toast.success("Estrutura pronta no Drive da Approva!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreatingStructure(false);
    }
  };

  const validarDocsTpl = async () => {
    if (!docsUrl.trim()) return toast.error("Cole o link do Google Docs.");
    setValDocsLoading(true);
    try {
      const r = await fnValidarDocs({ data: { url: docsUrl } });
      setDocs(r);
      await salvar("prestacao_template", { template_id: r.id, nome: r.name });
      toast.success(`Modelo "${r.name}" salvo!`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setValDocsLoading(false);
    }
  };

  const validarSheetsTpl = async () => {
    if (!sheetsUrl.trim()) return toast.error("Cole o link do Google Sheets.");
    setValSheetsLoading(true);
    try {
      const r = await fnValidarSheets({ data: { url: sheetsUrl } });
      setSheets({ id: r.id, name: r.name });
      await salvar("painel_template", { template_id: r.id, nome: r.name, abas: r.abas });
      toast.success(`Planilha "${r.name}" salva!`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setValSheetsLoading(false);
    }
  };

  const estruturaCompleta = !!drive && SUBPASTAS.every((n) => !!drive.subfolders?.[n]);

  const STEPS = [
    { n: 1, label: "Boas-vindas" },
    { n: 2, label: "Estrutura no Drive" },
    { n: 3, label: "Modelo Prestação" },
    { n: 4, label: "Modelo Painel" },
    { n: 5, label: "Concluído" },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando configuração…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <header>
        <Link
          to="/admin/configuracoes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para Configurações
        </Link>
        <h1 className="font-display text-3xl uppercase mt-3 flex items-center gap-2">
          <Sparkles className="h-7 w-7" /> Wizard de configuração inicial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Em 4 passos sua OSC fica pronta para uso. Pode pausar e retomar a qualquer momento.
        </p>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s) => {
          const done =
            (s.n === 1) ||
            (s.n === 2 && estruturaCompleta) ||
            (s.n === 3 && !!docs) ||
            (s.n === 4 && !!sheets) ||
            (s.n === 5 && estruturaCompleta && !!docs && !!sheets);
          const current = step === s.n;
          return (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors whitespace-nowrap",
                current
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                  ? "bg-accent/40 border-border text-foreground"
                  : "bg-background border-border text-muted-foreground",
              ].join(" ")}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
              <span className="font-medium">{s.n}.</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">👋 Antes de começar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              O Approva já tem uma conta de armazenamento dedicada — você não precisa conectar nada. Vamos
              só criar a pasta isolada da sua OSC e cadastrar dois modelos.
            </p>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Como funciona o armazenamento</AlertTitle>
              <AlertDescription>
                Seus documentos ficam em uma pasta exclusiva no Drive da Approva. Cada OSC tem o seu próprio
                espaço, isolado das demais. Você acessa tudo aqui mesmo, sem precisar abrir o Google Drive.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Começar <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📁 Passo 2 — Estrutura de pastas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              O Approva vai criar (ou reaproveitar) a pasta exclusiva da sua OSC com 4 subpastas. É idempotente
              — pode clicar quantas vezes precisar.
            </p>

            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pastas dentro do Drive da Approva</p>
                  <p className="text-xs text-muted-foreground">
                    <code>Approva/{`{sua-osc}`}/{`{Orçamentos, Cotações, Prestações, Documentos}`}</code>
                  </p>
                </div>
                <Button onClick={criarEstrutura} disabled={creatingStructure} size="sm">
                  {creatingStructure ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : estruturaCompleta ? (
                    "Verificar"
                  ) : (
                    "Criar estrutura"
                  )}
                </Button>
              </div>

              <ul className="space-y-1">
                {SUBPASTAS.map((nome) => {
                  const found = drive?.subfolders?.[nome];
                  return (
                    <li
                      key={nome}
                      className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        {nome}
                      </span>
                      {found ? (
                        <Badge variant="default" className="text-[10px]">pronta</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">pendente</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Os arquivos gerados (orçamentos, cotações, prestações) e os documentos da captura vão direto
                para esta pasta. Você acessa tudo em <Link to="/admin/arquivos" className="underline">Arquivos</Link>.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!estruturaCompleta}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📄 Passo 3 — Modelo de Prestação (Google Docs)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Este é o documento que o Approva vai duplicar e preencher toda vez que você gerar uma prestação
              de contas mensal.
            </p>
            <div className="space-y-2">
              <Label>Link do Google Docs</Label>
              <div className="flex gap-2">
                <Input
                  value={docsUrl}
                  onChange={(e) => setDocsUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/…/edit"
                />
                <Button onClick={validarDocsTpl} disabled={valDocsLoading}>
                  {valDocsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                </Button>
              </div>
              {docs && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
                  Modelo atual: <strong className="text-foreground">{docs.name}</strong>
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(4)} disabled={!docs}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Passo 4 — Modelo de Painel (Google Sheets)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Planilha-mestre que o Approva usa como base para o painel financeiro.
            </p>
            <div className="space-y-2">
              <Label>Link do Google Sheets</Label>
              <div className="flex gap-2">
                <Input
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                />
                <Button onClick={validarSheetsTpl} disabled={valSheetsLoading}>
                  {valSheetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                </Button>
              </div>
              {sheets && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-700" />
                  Planilha atual: <strong className="text-foreground">{sheets.name}</strong>
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(5)} disabled={!sheets}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎉 Tudo pronto!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Alert className="border-green-600/30 bg-green-600/5">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <AlertTitle>Configuração inicial concluída</AlertTitle>
              <AlertDescription>
                Sua OSC já pode lançar despesas, capturar comprovantes e gerar orçamentos.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/admin">Ir para o painel</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/arquivos">Ver arquivos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
