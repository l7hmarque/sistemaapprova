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
import {
  startGoogleDriveOAuth,
  saveGoogleConnection,
  getGoogleConnection,
  setupDriveStructure,
  disconnectGoogle,
} from "@/lib/google-oauth.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";

export const Route = createFileRoute("/admin/setup")({ component: WizardPage });

const SUBPASTAS = ["Orçamentos", "Cotações", "Prestações", "Documentos"];
const GATEWAY = "https://connector-gateway.lovable.dev";

type RootInfo = { id: string; name: string; link?: string } | null;
type SubInfo = Record<string, { id: string; name: string; created: boolean }> | null;
type FileInfo = { id: string; name: string } | null;
type GoogleConn = { connected: boolean; googleEmail?: string | null; since?: string } | null;

function WizardPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // step 2 — google connection + drive structure
  const [google, setGoogle] = useState<GoogleConn>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [root, setRoot] = useState<RootInfo>(null);
  const [subs, setSubs] = useState<SubInfo>(null);
  const [creatingStructure, setCreatingStructure] = useState(false);

  // step 3 (docs)
  const [docsUrl, setDocsUrl] = useState("");
  const [docs, setDocs] = useState<FileInfo>(null);
  const [valDocsLoading, setValDocsLoading] = useState(false);

  // step 4 (sheets)
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheets, setSheets] = useState<FileInfo>(null);
  const [valSheetsLoading, setValSheetsLoading] = useState(false);

  const fnStartOAuth = useServerFn(startGoogleDriveOAuth);
  const fnSaveConn = useServerFn(saveGoogleConnection);
  const fnGetConn = useServerFn(getGoogleConnection);
  const fnSetupDrive = useServerFn(setupDriveStructure);
  const fnDisconnect = useServerFn(disconnectGoogle);
  const fnValidarDocs = useServerFn(validarDocs);
  const fnValidarSheets = useServerFn(validarSheets);

  useEffect(() => {
    (async () => {
      const [{ data }, conn] = await Promise.all([
        supabase
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", ["wizard_drive_setup", "prestacao_template", "painel_template"]),
        fnGetConn().catch(() => ({ connected: false })),
      ]);
      const drive = data?.find((d) => d.chave === "wizard_drive_setup")?.valor as
        | { root?: RootInfo; subs?: SubInfo }
        | undefined;
      const presta = data?.find((d) => d.chave === "prestacao_template")?.valor as
        | { template_id?: string; nome?: string }
        | undefined;
      const painel = data?.find((d) => d.chave === "painel_template")?.valor as
        | { template_id?: string; nome?: string }
        | undefined;
      if (drive?.root) setRoot(drive.root);
      if (drive?.subs) setSubs(drive.subs);
      if (presta?.template_id) setDocs({ id: presta.template_id, name: presta.nome ?? "Prestação de Contas" });
      if (painel?.template_id) setSheets({ id: painel.template_id, name: painel.nome ?? "Painel Financeiro" });
      setGoogle(conn as GoogleConn);
      setLoading(false);
    })();
  }, []);

  const salvar = async (chave: string, valor: any) => {
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ chave, valor }, { onConflict: "chave" });
    if (error) toast.error("Erro ao salvar: " + error.message);
    return !error;
  };

  const conectarGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const result = await connectAppUser({
        connectorId: "google",
        gatewayBaseUrl: GATEWAY,
        start: async (targetOrigin) => {
          const r = await fnStartOAuth({
            data: { targetOrigin, returnUrl: `${targetOrigin}/admin/setup` },
          });
          return { authorizationUrl: r.authorizationUrl };
        },
      });
      if (!result.success || !result.connectionAPIKey) {
        toast.error(result.error ?? "Não foi possível conectar.");
        return;
      }
      const saved = await fnSaveConn({ data: { connectionAPIKey: result.connectionAPIKey } });
      setGoogle({ connected: true, googleEmail: saved.googleEmail });
      toast.success(`Conta Google conectada${saved.googleEmail ? ` (${saved.googleEmail})` : ""}!`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao conectar Google");
    } finally {
      setConnectingGoogle(false);
    }
  };

  const desconectarGoogle = async () => {
    if (!confirm("Desconectar a conta Google? O Approva não terá mais acesso ao Drive da OSC.")) return;
    try {
      await fnDisconnect();
      setGoogle({ connected: false });
      setRoot(null);
      setSubs(null);
      toast.success("Conta Google desconectada.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const criarEstrutura = async () => {
    setCreatingStructure(true);
    try {
      const r = await fnSetupDrive({ data: { rootName: "Approva" } });
      setRoot(r.root);
      setSubs(r.subs);
      toast.success("Estrutura de pastas pronta no seu Drive!");
    } catch (e: any) {
      toast.error(e.message);
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
    } catch (e: any) {
      toast.error(e.message);
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
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setValSheetsLoading(false);
    }
  };

  const estruturaCompleta = !!root && !!subs && Object.keys(subs).length === SUBPASTAS.length;

  const STEPS = [
    { n: 1, label: "Boas-vindas" },
    { n: 2, label: "Conectar Google" },
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
          Em 4 passos você conecta a conta Google da OSC e seus modelos. Pode pausar e retomar a qualquer momento.
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s) => {
          const done =
            (s.n === 1) ||
            (s.n === 2 && google?.connected && estruturaCompleta) ||
            (s.n === 3 && !!docs) ||
            (s.n === 4 && !!sheets) ||
            (s.n === 5 && google?.connected && estruturaCompleta && !!docs && !!sheets);
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

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">👋 Antes de começar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              Vamos conectar o Approva à conta Google da sua OSC. Tudo é guiado — sem precisar copiar e colar
              links de pastas.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">O que você vai precisar:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Login na conta Google da OSC.</li>
                <li>2 minutos.</li>
              </ul>
            </div>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Privacidade & segurança</AlertTitle>
              <AlertDescription>
                O Approva acessa <strong>apenas</strong> arquivos e pastas que ele mesmo criar (escopo
                <code className="mx-1 bg-muted px-1 rounded">drive.file</code>). Não temos acesso a outros
                documentos da sua conta. Você pode revogar a qualquer momento.
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

      {/* Step 2 — Connect Google + auto-create structure */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🔗 Passo 2 — Conectar conta Google da OSC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!google?.connected ? (
              <>
                <p>
                  Clique no botão abaixo para abrir o login do Google e autorizar o Approva a criar a pasta
                  raiz e subpastas no Drive da OSC.
                </p>
                <div className="flex justify-center py-4">
                  <Button size="lg" onClick={conectarGoogle} disabled={connectingGoogle}>
                    {connectingGoogle ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.6 3.7-5.35 3.7-3.2 0-5.8-2.6-5.8-5.8s2.6-5.8 5.8-5.8c1.4 0 2.7.5 3.7 1.3l2.4-2.4C16.5 3.6 14.4 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-9 0-.5 0-.9-.1-1.2z"
                        />
                      </svg>
                    )}
                    Conectar Google Drive
                  </Button>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Uma janela do Google vai abrir. Faça login com a conta da OSC e clique em "Permitir".
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <>
                <Alert className="border-green-600/30 bg-green-600/5">
                  <CheckCircle2 className="h-4 w-4 text-green-700" />
                  <AlertTitle>Conta conectada</AlertTitle>
                  <AlertDescription>
                    {google.googleEmail ? (
                      <>
                        Conectado como <strong>{google.googleEmail}</strong>.
                      </>
                    ) : (
                      "Conta Google vinculada."
                    )}
                    <button
                      type="button"
                      onClick={desconectarGoogle}
                      className="ml-2 underline text-muted-foreground hover:text-foreground"
                    >
                      desconectar
                    </button>
                  </AlertDescription>
                </Alert>

                <div className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Estrutura de pastas no Drive</p>
                      <p className="text-xs text-muted-foreground">
                        Vamos criar a pasta <strong>Approva</strong> com 4 subpastas. Idempotente — se já
                        existir, reaproveitamos.
                      </p>
                    </div>
                    <Button onClick={criarEstrutura} disabled={creatingStructure} size="sm">
                      {creatingStructure ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : estruturaCompleta ? (
                        "Recriar / verificar"
                      ) : (
                        "Criar estrutura"
                      )}
                    </Button>
                  </div>

                  {root && (
                    <div className="text-xs flex items-center gap-2 text-muted-foreground">
                      <FolderPlus className="h-3.5 w-3.5" />
                      Raiz:{" "}
                      <strong className="text-foreground">{root.name}</strong>
                      {root.link && (
                        <a href={root.link} target="_blank" rel="noreferrer" className="underline">
                          abrir
                        </a>
                      )}
                    </div>
                  )}

                  <ul className="space-y-1">
                    {SUBPASTAS.map((nome) => {
                      const found = subs?.[nome];
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
                            <Badge variant={found.created ? "default" : "secondary"} className="text-[10px]">
                              {found.created ? "criada" : "já existia"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              pendente
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!google?.connected || !estruturaCompleta}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Docs template */}
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
            </div>
            {docs && (
              <Alert className="border-green-600/30 bg-green-600/5">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                <AlertTitle>Modelo conectado</AlertTitle>
                <AlertDescription>{docs.name}</AlertDescription>
              </Alert>
            )}
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

      {/* Step 4 — Sheets template */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Passo 4 — Planilha do Painel (Google Sheets)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Esta é a planilha que alimenta o painel financeiro — o Approva lê e escreve nela
              automaticamente.
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
            </div>
            {sheets && (
              <Alert className="border-green-600/30 bg-green-600/5">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                <AlertTitle>Planilha conectada</AlertTitle>
                <AlertDescription>{sheets.name}</AlertDescription>
              </Alert>
            )}
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

      {/* Step 5 — Done */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎉 Tudo pronto!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>Configuração concluída. Resumo:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-700 mt-0.5" />
                <span>
                  Conta Google: <strong>{google?.googleEmail ?? (google?.connected ? "conectada" : "—")}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-700 mt-0.5" />
                <span>
                  Pasta raiz: <strong>{root?.name ?? "—"}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-700 mt-0.5" />
                <span>
                  Subpastas: <strong>{subs ? Object.keys(subs).join(", ") : "—"}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-700 mt-0.5" />
                <span>
                  Modelo de Prestação (Docs): <strong>{docs?.name ?? "—"}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-700 mt-0.5" />
                <span>
                  Modelo de Painel (Sheets): <strong>{sheets?.name ?? "—"}</strong>
                </span>
              </li>
            </ul>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Próximo passo</AlertTitle>
              <AlertDescription>
                Vá em <Link to="/admin/captura" className="underline">Captura</Link> e suba o primeiro PDF da
                sua prestação para testar.
              </AlertDescription>
            </Alert>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Revisar
              </Button>
              <Link
                to="/admin"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Ir para o painel
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
