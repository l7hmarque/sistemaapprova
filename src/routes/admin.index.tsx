import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { FileText, Users, Package, CalendarClock, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startAdminTour } from "@/components/tour/AdminTour";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

type Orc = { criado_em: string; tipo: string; fornecedor_id: string | null; dados: any };

function Dashboard() {
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [fornCount, setFornCount] = useState(0);
  const [objCount, setObjCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [o, f, ob] = await Promise.all([
        supabase.from("orcamentos_salvos").select("criado_em, tipo, fornecedor_id, dados").order("criado_em", { ascending: false }).limit(500),
        supabase.from("fornecedores").select("id", { count: "exact", head: true }),
        supabase.from("objetos_cotacao").select("id", { count: "exact", head: true }),
      ]);
      if (o.data) setOrcs(o.data as Orc[]);
      setFornCount(f.count ?? 0);
      setObjCount(ob.count ?? 0);
    })();
  }, []);

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const noMes = orcs.filter((o) => o.criado_em.startsWith(mesAtual)).length;

  // por mês (últimos 6)
  const meses: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses.push({ mes: k.slice(2), total: orcs.filter((o) => o.criado_em.startsWith(k)).length });
  }

  // gasto por mês (soma de dados.total quando existir)
  const gastoMes = meses.map((m) => {
    const k = `20${m.mes.replace("-", "-")}`;
    const total = orcs
      .filter((o) => o.criado_em.startsWith(k))
      .reduce((acc, o) => acc + (Number(o.dados?.total) || 0), 0);
    return { mes: m.mes, valor: Math.round(total) };
  });

  // distribuição por fornecedor (top 5)
  const porForn = new Map<string, number>();
  orcs.forEach((o) => {
    const k = o.fornecedor_id ?? "sem";
    porForn.set(k, (porForn.get(k) ?? 0) + 1);
  });
  const donut = [...porForn.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v], i) => ({ name: k === "sem" ? "Sem fornecedor" : `#${i + 1}`, value: v }));

  const TONS = ["#0a0a0a", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8"];

  return (
    <div className="p-8 space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl uppercase">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => startAdminTour()}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Refazer tour
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat icon={<FileText className="h-5 w-5" />} label="Orçamentos no mês" value={noMes} />
        <Stat icon={<Users className="h-5 w-5" />} label="Fornecedores" value={fornCount} />
        <Stat icon={<Package className="h-5 w-5" />} label="Objetos cadastrados" value={objCount} />
        <Stat icon={<CalendarClock className="h-5 w-5" />} label="Documentos a vencer" value={0} hint="Configure em Prestação" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Orçamentos por mês</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meses}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#0a0a0a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Valor por mês</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gastoMes}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="valor" stroke="#0a0a0a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm uppercase tracking-wide">Distribuição por fornecedor (top 5)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {donut.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {donut.map((_, i) => <Cell key={i} fill={TONS[i % TONS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="font-display text-4xl mt-3">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
