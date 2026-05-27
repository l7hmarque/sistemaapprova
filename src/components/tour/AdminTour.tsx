import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useRouterState } from "@tanstack/react-router";

const STORAGE_KEY = "synsit:admin-tour:v1";

const STEPS: Step[] = [
  {
    target: '[data-tour="sidebar"]',
    title: "Bem-vindo ao SynSIT",
    content:
      "Este é o seu painel. Toda gestão financeira da OSC acontece a partir daqui — orçamentos, fornecedores, prestação de contas e geração do TXT do SIT.",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: "Dashboard",
    content: "Visão geral: total de orçamentos no mês, fornecedores, objetos cadastrados e gastos por período.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-analytics"]',
    title: "Analytics",
    content: "Métricas de uso da equipe e indicadores de evolução da prestação de contas.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-painel"]',
    title: "Painel financeiro",
    content: "Acompanhe receitas, despesas e saldos por projeto/convênio em tempo real.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-captura"]',
    title: "Captura inteligente",
    content:
      "Suba PDFs de notas, boletos e guias. A IA extrai favorecido, valor, vencimento e classifica automaticamente.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-orcamentos"]',
    title: "Orçamentos & Cotações",
    content:
      "Gere cotações com 3 fornecedores em segundos, envie por link público e receba preços direto na plataforma.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-fornecedores"]',
    title: "Fornecedores",
    content: "Base unificada de CNPJ/CPF, com histórico de compras e validação automática.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-objetos"]',
    title: "Objetos de cotação",
    content: "Catálogo dos itens/serviços recorrentes da OSC para reaproveitar em novas cotações.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-modelos"]',
    title: "Modelos",
    content: "Templates de contrato, ofício, ata e declarações já adaptados à IN 201/2026 do TCE-PR.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-prestacao"]',
    title: "Prestação de contas",
    content:
      "Monta a pasta digital completa por mês/convênio e gera o arquivo TXT pronto para upload no SIT.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-aprovacoes"]',
    title: "Aprovações",
    content: "Fluxo de revisão: tudo que sai do operacional passa pelo coordenador antes de virar prestação.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-agenda"]',
    title: "Agenda",
    content: "Vencimentos, prazos do TCE e lembretes automáticos para não perder data de entrega.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-configuracoes"]',
    title: "Configurações",
    content: "Dados da organização, equipe (convites por e-mail), templates e alertas.",
    placement: "right",
  },
  {
    target: '[data-tour="user-area"]',
    title: "Sua conta",
    content:
      "Aqui aparece seu e-mail logado e o botão Sair. Se você for staff SynSIT, verá também o Painel Owner.",
    placement: "top",
  },
];

export function AdminTour() {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const done = window.localStorage.getItem(STORAGE_KEY);
    if (!done && pathname.startsWith("/admin")) {
      // pequeno delay pra garantir que sidebar montou
      const t = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  useEffect(() => {
    const handler = () => {
      window.localStorage.removeItem(STORAGE_KEY);
      setRun(true);
    };
    window.addEventListener("synsit:start-tour", handler);
    return () => window.removeEventListener("synsit:start-tour", handler);
  }, []);

  const onCb = (data: CallBackProps) => {
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(data.status)) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      setRun(false);
    }
  };

  if (!mounted) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableScrolling={false}
      callback={onCb}
      locale={{
        back: "Voltar",
        close: "Fechar",
        last: "Concluir",
        next: "Próximo",
        skip: "Pular tour",
      }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          arrowColor: "hsl(var(--background))",
          overlayColor: "rgba(0,0,0,0.55)",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          fontFamily: "inherit",
        },
        tooltipTitle: { fontSize: 14, fontWeight: 600 },
        tooltipContent: { fontSize: 13, lineHeight: 1.5 },
        buttonNext: { borderRadius: 6, fontSize: 13 },
        buttonBack: { color: "hsl(var(--muted-foreground))", fontSize: 13 },
        buttonSkip: { color: "hsl(var(--muted-foreground))", fontSize: 12 },
      }}
    />
  );
}

export function startAdminTour() {
  window.dispatchEvent(new CustomEvent("synsit:start-tour"));
}
