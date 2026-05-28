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
  ExternalLink,
  FolderPlus,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  validarPastaDrive,
  criarSubpastas,
  validarDocs,
  validarSheets,
} from "@/lib/setup-wizard.functions";

export const Route = createFileRoute("/admin/setup")({ component: WizardPage });

const SUBPASTAS = ["Orçamentos", "Cotações", "Prestações", "Documentos"];

type RootInfo = { id: string; name: string; link?: string } | null;
type SubInfo = Record<string, { id: string; name: string; created: boolean }> | null;
type FileInfo = { id: string; name: string } | null;

function WizardPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // step 2
  const [rootUrl, setRootUrl] = useState("");
  const [root, setRoot] = useState<RootInfo>(null);
  const [valRootLoading, setValRootLoading] = useState(false);

  // step 3
  const [subs, setSubs] = useState<SubInfo>(null);
  const [subLoading, setSubLoading] = useState(false);

  // step 4
  const [docsUrl, setDocsUrl] = useState("");
  const [docs, setDocs] = useState<FileInfo>(null);
  const [valDocsLoading, setValDocsLoading] = useState(false);

  // step 5
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheets, setSheets] = useState<FileInfo>(null);
  const [valSheetsLoading, setValSheetsLoading] = useState(false);

  const fnValidarPasta = useServerFn(validarPastaDrive);
  const fnCriarSubs = useServerFn(criarSubpastas);
  const fnValidarDocs = useServerFn(validarDocs);
  const fnValidarSheets = useServerFn(validarSheets);

  // carregar estado salvo
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["wizard_drive_setup", "prestacao_template", "painel_template"]);
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

  const validarRoot = async () => {
    if (!rootUrl.trim()) return toast.error("Cole o link da pasta.");
    setValRootLoading(true);
    try {
      const r = await fnValidarPasta({ data: { url: rootUrl } });
      setRoot(r);
      await salvar("wizard_drive_setup", { root: r, subs });
      toast.success(`Pasta "${r.name}" conectada!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setValRootLoading(false);
    }
  };

  const criarSubs = async () => {
    if (!root) return;
    setSubLoading(true);
    try {
      const r = await fnCriarSubs({ data: { parentId: root.id, nomes: SUBPASTAS } });
      setSubs(r);
      await salvar("wizard_drive_setup", { root, subs: r });
      const novas = Object.values(r).filter((s) => s.created).length;
      toast.success(novas > 0 ? `${novas} subpasta(s) criada(s)` : "Subpastas já existiam — vinculadas");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubLoading(false);
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

  const STEPS = [
    { n: 1, label: "Boas-vindas" },
    { n: 2, label: "Pasta no Drive" },
    { n: 3, label: "Subpastas" },
    { n: 4, label: "Modelo Prestação" },
    { n: 5, label: "Modelo Painel" },
    { n: 6, label: "Concluído" },
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
          Em 5 passos você conecta o Drive, Docs e Sheets. Pode pausar e retomar a qualquer momento — tudo
          fica salvo.
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const done =
            (s.n === 1) ||
            (s.n === 2 && !!root) ||
            (s.n === 3 && !!subs && Object.keys(subs).length === SUBPASTAS.length) ||
            (s.n === 4 && !!docs) ||
            (s.n === 5 && !!sheets) ||
            (s.n === 6 && !!root && !!subs && !!docs && !!sheets);
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
              Vamos conectar o Approva à sua conta do Google. Não se preocupe — você não precisa entender de
              tecnologia. Tudo é guiado.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">O que você vai precisar:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Acesso à conta Google da OSC (a mesma usada para arquivos da prestação).</li>
                <li>Permissão de criar pastas e arquivos no Google Drive.</li>
                <li>5 a 10 minutos.</li>
              </ul>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                A conexão com Google já foi feita pela equipe Approva. Aqui você só vai indicar{" "}
                <strong>onde</strong> ficam suas pastas e modelos.
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

      {/* Step 2 — Drive root */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📁 Passo 2 — Pasta raiz no Google Drive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">Como fazer (passo a passo):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>
                  Abra{" "}
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    drive.google.com <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  e faça login com a conta da OSC.
                </li>
                <li>
                  No menu lateral, clique em <strong>+ Novo → Nova pasta</strong>. Dê um nome como{" "}
                  <em>"Approva — [Nome da sua OSC]"</em>.
                </li>
                <li>
                  Entre na pasta criada. Na barra de endereços do navegador, copie a URL inteira (algo como{" "}
                  <code className="bg-muted px-1 rounded">drive.google.com/drive/folders/1abc...</code>).
                </li>
                <li>Cole abaixo e clique em "Validar".</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Label>Link da pasta raiz</Label>
              <div className="flex gap-2">
                <Input
                  value={rootUrl}
                  onChange={(e) => setRootUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                />
                <Button onClick={validarRoot} disabled={valRootLoading}>
                  {valRootLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                </Button>
              </div>
            </div>
            {root && (
              <Alert className="border-green-600/30 bg-green-600/5">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                <AlertTitle>Pasta conectada</AlertTitle>
                <AlertDescription>
                  <strong>{root.name}</strong>
                  {root.link && (
                    <>
                      {" "}
                      —{" "}
                      <a href={root.link} target="_blank" rel="noreferrer" className="underline">
                        abrir no Drive
                      </a>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!root}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Subpastas */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🗂️ Passo 3 — Subpastas organizadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Vamos criar 4 subpastas dentro de <strong>{root?.name ?? "sua pasta raiz"}</strong> para
              organizar os documentos automaticamente:
            </p>
            <ul className="space-y-1">
              {SUBPASTAS.map((nome) => {
                const found = subs?.[nome];
                return (
                  <li key={nome} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FolderPlus className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{nome}</span>
                    </div>
                    {found ? (
                      <Badge variant={found.created ? "default" : "secondary"}>
                        {found.created ? "criada" : "já existia"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">pendente</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Se já existir uma subpasta com o mesmo nome, ela será reutilizada — nada é duplicado.
              </AlertDescription>
            </Alert>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <div className="flex gap-2">
                <Button onClick={criarSubs} disabled={subLoading || !root}>
                  {subLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar / vincular subpastas"}
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!subs || Object.keys(subs).length < SUBPASTAS.length}
                >
                  Próximo <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Docs template */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📄 Passo 4 — Modelo de Prestação (Google Docs)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Este é o documento que o Approva vai duplicar e preencher toda vez que você gerar uma prestação
              de contas mensal.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">Como fazer:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>
                  Use o modelo padrão Approva (recomendado) — peça à equipe pelo WhatsApp suporte e ela te
                  envia o link de cópia.
                </li>
                <li>
                  Ou, se você já tem o seu modelo: abra-o no Google Docs, copie a URL completa da barra de
                  endereços.
                </li>
                <li>Cole abaixo e clique em "Validar".</li>
              </ol>
            </div>
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
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(5)} disabled={!docs}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — Sheets template */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Passo 5 — Planilha do Painel (Google Sheets)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Esta é a planilha que alimenta o painel financeiro (receitas, despesas, saldo) — o Approva lê e
              escreve nela automaticamente.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">Como fazer:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Solicite o modelo Approva no suporte ou use uma planilha existente da OSC.</li>
                <li>Abra no Google Sheets, copie a URL completa da barra de endereços.</li>
                <li>Cole abaixo e clique em "Validar". Mostraremos as abas detectadas.</li>
              </ol>
            </div>
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
              <Button variant="outline" onClick={() => setStep(4)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(6)} disabled={!sheets}>
                Próximo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6 — Done */}
      {step === 6 && (
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
              <Button variant="outline" onClick={() => setStep(5)}>
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
