import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovaLogo } from "@/components/brand/ApprovaLogo";
import {
  LayoutDashboard, FileText, Users, Package, FolderCheck, ShieldCheck,
  CalendarDays, Wallet, Camera, Settings, FileCog, BarChart3, Building2,
  ChevronsUpDown, Search, Filter, Download, Plus, Eye, Check, Clock, AlertCircle,
} from "lucide-react";

type ScreenKey =
  | "dashboard"
  | "orcamentos"
  | "prestacao"
  | "aprovacoes"
  | "captura"
  | "painel"
  | "escritorio";

export const Route = createFileRoute("/showcase/$screen")({
  component: ShowcasePage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex,nofollow" },
      { title: "Approva — Showcase" },
    ],
  }),
});

function ShowcasePage() {
  const { screen } = Route.useParams() as { screen: ScreenKey };
  // remove qualquer scroll para captura limpa
  useEffect(() => {
    document.body.style.background = "#0b1326";
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f3ee] flex">
      <Sidebar active={screen} />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <div className="flex-1 p-8">
          {screen === "dashboard" && <DashboardMock />}
          {screen === "orcamentos" && <OrcamentosMock />}
          {screen === "prestacao" && <PrestacaoMock />}
          {screen === "aprovacoes" && <AprovacoesMock />}
          {screen === "captura" && <CapturaMock />}
          {screen === "painel" && <PainelMock />}
          {screen === "escritorio" && <EscritorioMock />}
        </div>
      </main>
    </div>
  );
}

const NAV = [
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard", color: "var(--primary)" },
  { key: "painel", icon: Wallet, label: "Painel financeiro", color: "oklch(0.62 0.15 160)" },
  { key: "captura", icon: Camera, label: "Captura", color: "oklch(0.68 0.18 50)" },
  { key: "orcamentos", icon: FileText, label: "Orçamentos", color: "oklch(0.72 0.16 75)" },
  { key: "fornecedores", icon: Users, label: "Fornecedores", color: "oklch(0.65 0.13 200)" },
  { key: "objetos", icon: Package, label: "Objetos", color: "oklch(0.68 0.13 220)" },
  { key: "modelos", icon: FileCog, label: "Modelos", color: "oklch(0.6 0.16 290)" },
  { key: "prestacao", icon: FolderCheck, label: "Prestação", color: "oklch(0.6 0.16 150)" },
  { key: "aprovacoes", icon: ShieldCheck, label: "Aprovações", color: "oklch(0.55 0.18 310)" },
  { key: "agenda", icon: CalendarDays, label: "Agenda", color: "oklch(0.7 0.13 0)" },
  { key: "configuracoes", icon: Settings, label: "Configurações", color: "oklch(0.6 0.02 250)" },
];

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="w-60 shrink-0 border-r border-[#e3dfd4] bg-white min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-[#e3dfd4]">
        <ApprovaLogo variant="full" size="md" />
        <div className="text-[10px] uppercase tracking-widest text-[#7c7565] mt-2">Painel Admin</div>
      </div>
      <nav className="p-3 flex flex-col gap-0.5 flex-1">
        {NAV.map((it) => {
          const Icon = it.icon;
          const isActive = it.key === active;
          return (
            <div
              key={it.key}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md"
              style={
                isActive
                  ? { background: `color-mix(in oklab, ${it.color} 12%, white)`, boxShadow: `inset 3px 0 0 0 ${it.color}` }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" style={isActive ? { color: it.color } : { color: "#7c7565" }} />
              <span className={isActive ? "font-semibold text-[#0f1b3d]" : "text-[#3d3a33]"}>{it.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[#e3dfd4] text-xs text-[#7c7565]">maria@institutoexemplo.org</div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#e3dfd4] px-6 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#e3dfd4] bg-white text-sm max-w-[280px]">
        <Building2 className="h-4 w-4 text-[#7c7565]" />
        <span className="font-medium text-[#0f1b3d] truncate">Instituto Exemplo</span>
        <span className="text-[10px] uppercase tracking-widest text-[#7c7565]">OSC</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-[#7c7565]" />
      </div>
      <div className="ml-auto text-xs text-[#7c7565]">OSC · Instituto Exemplo de Educação</div>
    </header>
  );
}

/* ───────────────────────── DASHBOARD ───────────────────────── */
function DashboardMock() {
  return (
    <div className="space-y-6">
      <Header title="Dashboard" subtitle="Visão geral · Termo de Fomento 042/2025" />
      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Orçamentos no mês" value="14" />
        <Kpi label="Fornecedores" value="38" />
        <Kpi label="Documentos a vencer" value="3" tone="warning" />
        <Kpi label="Aguardando aprovação" value="7" tone="pending" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Orçamentos por mês</CardTitle></CardHeader>
          <CardContent className="h-56 flex items-end gap-3 px-2">
            {[6, 9, 11, 8, 12, 14].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t bg-[#1e3a5f]" style={{ height: `${v * 12}px` }} />
                <span className="text-[10px] text-[#7c7565]">{["jun","jul","ago","set","out","nov"][i]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Execução do termo</CardTitle></CardHeader>
          <CardContent>
            <ProgressRow label="Recursos humanos" pct={72} color="oklch(0.6 0.16 150)" v="R$ 86.400,00" />
            <ProgressRow label="Material de consumo" pct={48} color="oklch(0.72 0.16 75)" v="R$ 19.200,00" />
            <ProgressRow label="Serviços de terceiros" pct={31} color="oklch(0.65 0.13 200)" v="R$ 9.300,00" />
            <ProgressRow label="Encargos" pct={88} color="oklch(0.55 0.18 310)" v="R$ 17.600,00" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── ORÇAMENTOS ───────────────────────── */
function OrcamentosMock() {
  const rows = [
    ["ORC-2025-0142", "Compra de material pedagógico", "Papelaria Central LTDA", "12/11/2025", "R$ 2.840,00", "aprovado"],
    ["ORC-2025-0141", "Manutenção preventiva ar-cond.", "Refrigeração Sul ME", "11/11/2025", "R$ 1.450,00", "pendente"],
    ["ORC-2025-0140", "Lanche oficinas SCFV", "Pão Quente Padaria", "10/11/2025", "R$ 980,00", "aprovado"],
    ["ORC-2025-0139", "Uniformes equipe técnica", "Confecções Sol", "09/11/2025", "R$ 3.620,00", "rascunho"],
    ["ORC-2025-0138", "Internet sede administrativa", "NetSul Telecom", "08/11/2025", "R$ 320,00", "aprovado"],
    ["ORC-2025-0137", "Materiais de limpeza", "Distribuidora Limpa", "07/11/2025", "R$ 1.180,00", "rejeitado"],
  ];
  return (
    <div className="space-y-6">
      <Header title="Orçamentos" subtitle="Cotações enviadas e respostas dos fornecedores" actions={
        <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[oklch(0.72_0.16_75)] text-white text-sm font-medium">
          <Plus className="h-4 w-4" /> Novo orçamento
        </button>
      } module="orcamentos" />
      <div className="flex gap-2">
        <SearchInput placeholder="Buscar por nº, objeto ou fornecedor…" />
        <Chip icon={<Filter className="h-3 w-3" />} label="Status: todos" />
        <Chip label="Mês: novembro/2025" />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf8f3] text-[11px] uppercase tracking-wide text-[#7c7565]">
              <tr>
                {["Nº", "Objeto", "Fornecedor", "Data", "Valor", "Status", ""].map((c) => (
                  <th key={c} className="text-left px-4 py-3 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[#eee7d8]">
                  <td className="px-4 py-3 font-mono text-xs">{r[0]}</td>
                  <td className="px-4 py-3">{r[1]}</td>
                  <td className="px-4 py-3 text-[#3d3a33]">{r[2]}</td>
                  <td className="px-4 py-3 text-[#7c7565]">{r[3]}</td>
                  <td className="px-4 py-3 font-semibold">{r[4]}</td>
                  <td className="px-4 py-3"><Status v={r[5]} /></td>
                  <td className="px-4 py-3"><Eye className="h-4 w-4 text-[#7c7565]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── PRESTAÇÃO ───────────────────────── */
function PrestacaoMock() {
  const rows = [
    ["NF-e 142.318", "Salário coordenação técnica", "Recursos Humanos", "R$ 4.200,00", "anexo", "aprovado"],
    ["GFIP 11/2025", "INSS competência 11/2025", "Encargos", "R$ 1.176,00", "anexo", "aprovado"],
    ["NF-e 098.221", "Lanche oficinas SCFV", "Material de consumo", "R$ 980,00", "anexo", "pendente"],
    ["Boleto Copel", "Energia elétrica - sede", "Despesas correntes", "R$ 612,40", "anexo", "aprovado"],
    ["NF-e 011.477", "Manutenção elétrica preventiva", "Serviços terceiros", "R$ 1.450,00", "sem", "pendente"],
    ["Holerite 11/2025", "Auxiliar pedagógica - 11/2025", "Recursos Humanos", "R$ 2.380,00", "anexo", "aprovado"],
  ];
  return (
    <div className="space-y-6">
      <Header title="Prestação · Termo 042/2025" subtitle="Outubro/2025 · 32 lançamentos · 4 pendentes" module="prestacao" actions={
        <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[oklch(0.6_0.16_150)] text-white text-sm font-medium">
          <Download className="h-4 w-4" /> Exportar SIT/TCE-PR
        </button>
      } />
      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Total no mês" value="R$ 38.420,00" />
        <Kpi label="Com comprovante" value="28 de 32" tone="success" />
        <Kpi label="Aguardando aprovação" value="4" tone="pending" />
        <Kpi label="Pronto pra SIT" value="87%" tone="success" />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf8f3] text-[11px] uppercase tracking-wide text-[#7c7565]">
              <tr>{["Documento","Descrição","Rubrica","Valor","Comprov.","Aprovação"].map((c) => (
                <th key={c} className="text-left px-4 py-3 font-medium">{c}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[#eee7d8]">
                  <td className="px-4 py-3 font-mono text-xs">{r[0]}</td>
                  <td className="px-4 py-3">{r[1]}</td>
                  <td className="px-4 py-3 text-[#3d3a33]">{r[2]}</td>
                  <td className="px-4 py-3 font-semibold">{r[3]}</td>
                  <td className="px-4 py-3">
                    {r[4] === "anexo"
                      ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><Check className="h-3 w-3" /> anexado</span>
                      : <span className="inline-flex items-center gap-1 text-amber-700 text-xs"><AlertCircle className="h-3 w-3" /> faltando</span>}
                  </td>
                  <td className="px-4 py-3"><Status v={r[5]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── APROVAÇÕES ───────────────────────── */
function AprovacoesMock() {
  const items = [
    { titulo: "Compra de material pedagógico", fornecedor: "Papelaria Central LTDA", valor: "R$ 2.840,00", solicitante: "Maria Souza", quando: "há 2h" },
    { titulo: "Manutenção preventiva ar-cond.", fornecedor: "Refrigeração Sul ME", valor: "R$ 1.450,00", solicitante: "Carlos Lima", quando: "há 5h" },
    { titulo: "Lanche oficinas SCFV", fornecedor: "Pão Quente Padaria", valor: "R$ 980,00", solicitante: "Ana Beatriz", quando: "ontem" },
  ];
  return (
    <div className="space-y-6">
      <Header title="Aprovações" subtitle="Despesas aguardando 2ª assinatura — revisão em duas mãos" module="aprovacoes" />
      <div className="grid grid-cols-3 gap-4">
        {items.map((it, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-[#0f1b3d]">{it.titulo}</div>
                <StatusBadge variant="pending">Pendente</StatusBadge>
              </div>
              <div className="text-xs text-[#7c7565]">{it.fornecedor}</div>
              <div className="text-2xl font-display text-[#0f1b3d]">{it.valor}</div>
              <div className="text-xs text-[#7c7565]">Solicitado por <strong className="text-[#3d3a33]">{it.solicitante}</strong> · {it.quando}</div>
              <div className="flex gap-2 pt-2">
                <button className="flex-1 px-3 py-2 rounded-md bg-[oklch(0.55_0.18_310)] text-white text-sm font-medium">Aprovar</button>
                <button className="flex-1 px-3 py-2 rounded-md border border-[#e3dfd4] text-sm">Rejeitar</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── CAPTURA ───────────────────────── */
function CapturaMock() {
  const fila = [
    ["NF-e 098.221.xml", "Pão Quente Padaria", "R$ 980,00", "lido"],
    ["boleto-copel-11.pdf", "Companhia Paranaense de Energia", "R$ 612,40", "lido"],
    ["holerite-mariana.pdf", "Mariana Soares", "R$ 2.380,00", "lendo"],
    ["nfe-142318.xml", "Recursos Humanos LTDA", "R$ 4.200,00", "lido"],
  ];
  return (
    <div className="space-y-6">
      <Header title="Captura" subtitle="Importe NF-e, boletos, guias e holerites — a IA categoriza" module="captura" />
      <Card className="border-2 border-dashed border-[#e3dfd4] bg-[#faf8f3]">
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-full bg-[oklch(0.68_0.18_50_/_0.15)] flex items-center justify-center mb-3">
            <Camera className="h-7 w-7 text-[oklch(0.68_0.18_50)]" />
          </div>
          <div className="text-base font-semibold text-[#0f1b3d]">Arraste o PDF mensal ou XMLs aqui</div>
          <div className="text-xs text-[#7c7565] mt-1">A IA lê NF-e, boletos, guias e holerites — você só revisa</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Fila de leitura · 4 arquivos</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf8f3] text-[11px] uppercase tracking-wide text-[#7c7565]">
              <tr>{["Arquivo","Emitente","Valor","Status"].map((c) => <th key={c} className="text-left px-4 py-3 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {fila.map((r, i) => (
                <tr key={i} className="border-t border-[#eee7d8]">
                  <td className="px-4 py-3 font-mono text-xs">{r[0]}</td>
                  <td className="px-4 py-3">{r[1]}</td>
                  <td className="px-4 py-3 font-semibold">{r[2]}</td>
                  <td className="px-4 py-3">
                    {r[3] === "lido"
                      ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><Check className="h-3 w-3" /> lido</span>
                      : <span className="inline-flex items-center gap-1 text-blue-700 text-xs"><Clock className="h-3 w-3" /> processando</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── PAINEL FINANCEIRO ───────────────────────── */
function PainelMock() {
  return (
    <div className="space-y-6">
      <Header title="Painel financeiro" subtitle="Saldos por termo, projeção e alertas" module="painel" />
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Saldo Termo 042/2025" value="R$ 24.180,55" tone="success" />
        <Kpi label="Próximo repasse" value="R$ 32.000,00" hint="dia 28/11" />
        <Kpi label="A executar até 31/12" value="R$ 41.700,00" tone="warning" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Execução por rubrica</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ProgressRow label="Recursos humanos" pct={72} color="oklch(0.6 0.16 150)" v="R$ 86.400,00 / R$ 120.000,00" />
          <ProgressRow label="Material de consumo" pct={48} color="oklch(0.72 0.16 75)" v="R$ 19.200,00 / R$ 40.000,00" />
          <ProgressRow label="Serviços terceiros" pct={31} color="oklch(0.65 0.13 200)" v="R$ 9.300,00 / R$ 30.000,00" />
          <ProgressRow label="Encargos" pct={88} color="oklch(0.55 0.18 310)" v="R$ 17.600,00 / R$ 20.000,00" />
          <ProgressRow label="Diárias e viagens" pct={12} color="oklch(0.68 0.13 220)" v="R$ 1.440,00 / R$ 12.000,00" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── ESCRITÓRIO ───────────────────────── */
function EscritorioMock() {
  const oscs = [
    { nome: "Instituto Esperança", status: "em dia", mes: "out/2025", pendentes: 0, cor: "oklch(0.6 0.16 150)" },
    { nome: "Casa do Caminho", status: "3 pendências", mes: "out/2025", pendentes: 3, cor: "oklch(0.72 0.16 75)" },
    { nome: "Lar Recanto Feliz", status: "atrasado", mes: "set/2025", pendentes: 7, cor: "oklch(0.55 0.18 25)" },
    { nome: "Associação Amigos do Bem", status: "em dia", mes: "out/2025", pendentes: 0, cor: "oklch(0.6 0.16 150)" },
    { nome: "ONG Crescer", status: "em dia", mes: "out/2025", pendentes: 1, cor: "oklch(0.6 0.16 150)" },
    { nome: "Fundação Renascer", status: "5 pendências", mes: "out/2025", pendentes: 5, cor: "oklch(0.72 0.16 75)" },
  ];
  return (
    <div className="space-y-6">
      <Header title="Escritório · 6 OSCs ativas" subtitle="Visão consolidada do mês — clique numa OSC para entrar no contexto" />
      <div className="grid grid-cols-4 gap-4">
        <Kpi label="OSCs ativas" value="6" />
        <Kpi label="Em dia" value="3" tone="success" />
        <Kpi label="Com pendências" value="2" tone="warning" />
        <Kpi label="Atrasadas" value="1" tone="danger" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {oscs.map((o) => (
          <Card key={o.nome} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 space-y-2">
              <div className="text-sm font-semibold text-[#0f1b3d]">{o.nome}</div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: o.cor }} />
                <span className="text-xs text-[#3d3a33]">{o.status}</span>
                <span className="text-xs text-[#7c7565] ml-auto">{o.mes}</span>
              </div>
              <div className="text-2xl font-display text-[#0f1b3d]">{o.pendentes}</div>
              <div className="text-xs text-[#7c7565]">documentos pendentes</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */
function Header({ title, subtitle, actions, module }: { title: string; subtitle?: string; actions?: React.ReactNode; module?: string }) {
  const colors: Record<string, string> = {
    prestacao: "oklch(0.6 0.16 150)",
    orcamentos: "oklch(0.72 0.16 75)",
    aprovacoes: "oklch(0.55 0.18 310)",
    captura: "oklch(0.68 0.18 50)",
    painel: "oklch(0.62 0.15 160)",
  };
  return (
    <header className="flex items-start justify-between gap-4 border-l-4 pl-4" style={{ borderColor: colors[module ?? ""] ?? "#1e3a5f" }}>
      <div>
        <h1 className="text-3xl font-display uppercase tracking-tight text-[#0f1b3d]">{title}</h1>
        {subtitle && <p className="text-sm text-[#7c7565] mt-1">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warning" | "danger" | "pending" }) {
  const toneColor =
    tone === "success" ? "oklch(0.6 0.16 150)" :
    tone === "warning" ? "oklch(0.72 0.16 75)" :
    tone === "danger" ? "oklch(0.55 0.18 25)" :
    tone === "pending" ? "oklch(0.55 0.18 310)" : "#0f1b3d";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-[#7c7565]">{label}</div>
        <div className="font-display text-3xl mt-2" style={{ color: toneColor }}>{value}</div>
        {hint && <div className="text-xs text-[#7c7565] mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
function ProgressRow({ label, pct, color, v }: { label: string; pct: number; color: string; v: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-[#3d3a33] font-medium">{label}</span>
        <span className="text-[#7c7565]">{v} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#eee7d8] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
function Status({ v }: { v: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    aprovado: { bg: "oklch(0.95 0.06 150)", fg: "oklch(0.4 0.18 150)", label: "Aprovado" },
    pendente: { bg: "oklch(0.96 0.08 75)", fg: "oklch(0.5 0.18 75)", label: "Pendente" },
    rejeitado: { bg: "oklch(0.95 0.05 25)", fg: "oklch(0.5 0.2 25)", label: "Rejeitado" },
    rascunho: { bg: "oklch(0.96 0.005 250)", fg: "oklch(0.5 0.02 250)", label: "Rascunho" },
  };
  const s = map[v] ?? map.rascunho;
  return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}
function SearchInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md border border-[#e3dfd4] bg-white text-sm">
      <Search className="h-4 w-4 text-[#7c7565]" />
      <input className="flex-1 bg-transparent outline-none text-[#3d3a33]" placeholder={placeholder} />
    </div>
  );
}
function Chip({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#e3dfd4] bg-white text-xs text-[#3d3a33]">
      {icon}{label}
    </span>
  );
}
