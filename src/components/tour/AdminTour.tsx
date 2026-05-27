import { useEffect, useMemo, useState } from "react";
import { Joyride, STATUS, type EventData, type Step } from "react-joyride";
import { useRouterState } from "@tanstack/react-router";

const STORAGE_PREFIX = "synsit:tour:v2:";

// Tour global do painel (1ª visita em /admin)
const GLOBAL_STEPS: Step[] = [
  {
    target: '[data-tour="sidebar"]',
    title: "Bem-vindo ao SynSIT 👋",
    content:
      "Este é o seu painel. Tudo da OSC — orçamentos, fornecedores, prestação e o TXT do SIT — começa por este menu lateral.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: "Dashboard",
    content: "Resumo do mês: orçamentos, gastos, fornecedores ativos.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-captura"]',
    title: "Captura inteligente",
    content: "Suba PDFs de notas/boletos/guias e o sistema preenche tudo automaticamente: favorecido, valor, vencimento.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-orcamentos"]',
    title: "Orçamentos & Cotações",
    content: "Gere 3 cotações de fornecedores em segundos com link público.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-prestacao"]',
    title: "Prestação de contas",
    content: "Monta a pasta digital e gera o TXT do SIT pronto pra subir no TCE-PR.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-configuracoes"]',
    title: "Comece pela Configuração inicial",
    content:
      "Antes de usar, faça a configuração inicial em Configurações → Wizard. Conectamos Drive, Docs e Sheets em 5 passos guiados.",
    placement: "right",
  },
];

// Tours por página — disparam na 1ª visita de cada rota
const PAGE_STEPS: Record<string, Step[]> = {
  "/admin/captura": [
    {
      target: 'main h1, [data-tour-anchor="page-title"]',
      title: "Página de Captura",
      content:
        "Aqui você sobe documentos (PDF). O sistema lê e extrai automaticamente: favorecido, CNPJ, valor, data e tipo (NF, boleto, guia).",
      placement: "bottom",
    },
    {
      target: '[data-tour-anchor="captura-upload"], main',
      title: "Como usar",
      content:
        "1) Arraste o PDF (ou clique para selecionar). 2) Aguarde processar. 3) Confira o vínculo com o evento financeiro previsto.",
      placement: "auto",
    },
  ],
  "/admin/orcamentos": [
    {
      target: "main h1",
      title: "Cotações",
      content:
        "Crie um pedido de cotação, adicione itens e envie por link público para os fornecedores responderem. Quando 3 responderem, o mapa comparativo é gerado.",
      placement: "bottom",
    },
    {
      target: '[data-tour-anchor="orcamento-novo"], main button',
      title: "Nova cotação",
      content: "Comece por aqui. Você pode partir de zero ou usar um preset salvo.",
      placement: "auto",
    },
  ],
  "/admin/fornecedores": [
    {
      target: "main h1",
      title: "Fornecedores",
      content:
        "Base unificada de CNPJ/CPF. Cadastre 1x e reutilize em todas as cotações e prestações. Tem validador de CNPJ embutido.",
      placement: "bottom",
    },
  ],
  "/admin/objetos": [
    {
      target: "main h1",
      title: "Objetos de cotação",
      content:
        "Catálogo dos itens/serviços recorrentes (ex.: lanche escolar, material esportivo). Reutilize em novas cotações sem redigitar.",
      placement: "bottom",
    },
  ],
  "/admin/modelos": [
    {
      target: "main h1",
      title: "Modelos de planilha",
      content:
        "Templates do Google Sheets para Orçamento, Mapa Comparativo e Controle Bancário. Configure 1x — o sistema usa em todas as gerações.",
      placement: "bottom",
    },
    {
      target: '[data-tour-anchor="modelo-novo"], main button',
      title: "Cadastrar modelo",
      content: "Cole a URL do Google Sheets, escolha o tipo e o sistema valida a aba/linhas automaticamente.",
      placement: "auto",
    },
  ],
  "/admin/prestacao": [
    {
      target: "main h1",
      title: "Prestação de contas",
      content:
        "Monta a pasta digital do mês: documentos por evento financeiro. Ao final, gera o documento de Prestação no Docs e o TXT do SIT.",
      placement: "bottom",
    },
    {
      target: '[data-tour-anchor="prestacao-gerar"], main button',
      title: "Gerar prestação",
      content: "Quando todos os documentos estiverem no mês, clique aqui para gerar o snapshot e o arquivo TXT.",
      placement: "auto",
    },
  ],
  "/admin/aprovacoes": [
    {
      target: "main h1",
      title: "Aprovações",
      content:
        "Tudo que sai do operacional passa pelo coordenador antes de virar prestação. Aprovações pendentes aparecem aqui.",
      placement: "bottom",
    },
  ],
  "/admin/agenda": [
    {
      target: "main h1",
      title: "Agenda",
      content:
        "Calendário de vencimentos, prazos do TCE e lembretes automáticos. Importante: configure os destinatários de alerta em Configurações.",
      placement: "bottom",
    },
  ],
  "/admin/painel": [
    {
      target: "main h1",
      title: "Painel financeiro",
      content: "Receitas, despesas e saldo por projeto/convênio. Atualizado em tempo real.",
      placement: "bottom",
    },
  ],
  "/admin/analytics": [
    {
      target: "main h1",
      title: "Analytics",
      content: "Métricas de uso da equipe e evolução da prestação ao longo do tempo.",
      placement: "bottom",
    },
  ],
  "/admin/configuracoes": [
    {
      target: "main h1",
      title: "Configurações",
      content:
        "Comece pelo Wizard de Configuração Inicial — em 5 passos você conecta Drive, Docs e Sheets, sem precisar entender de tecnologia.",
      placement: "bottom",
    },
    {
      target: '[data-tour-anchor="wizard-card"]',
      title: "Wizard guiado",
      content: "Clique em 'Iniciar wizard' para começar. Você pode pausar e retomar quando quiser.",
      placement: "top",
    },
  ],
};

function matchPageKey(pathname: string): string | null {
  // exato primeiro
  if (PAGE_STEPS[pathname]) return pathname;
  // prefix (ex.: /admin/orcamentos/123 → /admin/orcamentos)
  const keys = Object.keys(PAGE_STEPS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname.startsWith(k + "/")) return k;
  }
  return null;
}

export function AdminTour() {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [mounted, setMounted] = useState(false);
  const [tourKey, setTourKey] = useState<string>("");
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    setMounted(true);
  }, []);

  // dispara tour conforme rota
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (!pathname.startsWith("/admin")) return;

    // tour global em /admin
    const isDashboardRoot = pathname === "/admin" || pathname === "/admin/";
    if (isDashboardRoot) {
      const k = "global";
      if (!window.localStorage.getItem(STORAGE_PREFIX + k)) {
        setSteps(GLOBAL_STEPS);
        setTourKey(k);
        const t = setTimeout(() => setRun(true), 600);
        return () => clearTimeout(t);
      }
      return;
    }

    // tour da página
    const pageKey = matchPageKey(pathname);
    if (pageKey) {
      const k = "page:" + pageKey;
      if (!window.localStorage.getItem(STORAGE_PREFIX + k)) {
        setSteps(PAGE_STEPS[pageKey]);
        setTourKey(k);
        const t = setTimeout(() => setRun(true), 500);
        return () => clearTimeout(t);
      }
    }
  }, [pathname, mounted]);

  // escuta evento manual
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ scope?: "global" | "page" }>;
      const scope = custom.detail?.scope ?? "global";
      if (scope === "global") {
        window.localStorage.removeItem(STORAGE_PREFIX + "global");
        setSteps(GLOBAL_STEPS);
        setTourKey("global");
      } else {
        const pageKey = matchPageKey(pathname);
        if (!pageKey) return;
        const k = "page:" + pageKey;
        window.localStorage.removeItem(STORAGE_PREFIX + k);
        setSteps(PAGE_STEPS[pageKey]);
        setTourKey(k);
      }
      setRun(true);
    };
    window.addEventListener("synsit:start-tour", handler as EventListener);
    return () => window.removeEventListener("synsit:start-tour", handler as EventListener);
  }, [pathname]);

  const onCb = (data: EventData) => {
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(data.status as string)) {
      if (tourKey) window.localStorage.setItem(STORAGE_PREFIX + tourKey, "1");
      setRun(false);
    }
  };

  if (!mounted || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={onCb as any}
      options={{ showProgress: true, skipBeacon: true }}
      locale={{
        back: "Voltar",
        close: "Fechar",
        last: "Concluir",
        next: "Próximo",
        skip: "Pular",
      }}
      styles={{
        overlay: { backgroundColor: "rgba(0,0,0,0.55)" },
        tooltip: { borderRadius: 8, fontFamily: "inherit", fontSize: 13 },
        buttonPrimary: { borderRadius: 6, fontSize: 13, backgroundColor: "hsl(var(--primary))" },
        buttonBack: { color: "hsl(var(--muted-foreground))", fontSize: 13 },
        buttonSkip: { color: "hsl(var(--muted-foreground))", fontSize: 12 },
      }}
    />
  );
}

export function startAdminTour(scope: "global" | "page" = "global") {
  window.dispatchEvent(new CustomEvent("synsit:start-tour", { detail: { scope } }));
}
