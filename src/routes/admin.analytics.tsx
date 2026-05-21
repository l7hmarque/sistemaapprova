import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { obterAnalytics } from "@/lib/analytics.functions";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SIT" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [dias, setDias] = useState(30);
  const fetchAnalytics = useServerFn(obterAnalytics);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["analytics", dias],
    queryFn: () => fetchAnalytics({ data: { dias } }),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Telemetria 1st-party — sem cookies de terceiros.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                dias === d ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
              }`}
            >
              {d} dias
            </button>
          ))}
          <button onClick={() => refetch()} className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted">
            Atualizar
          </button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.ok === false && <p className="text-destructive">{data.error}</p>}

      {data?.ok && (
        <>
          <Card title={`Total de eventos: ${data.total.toLocaleString("pt-BR")}`}>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={data.visitasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="n" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Visitas" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card title="Visitas por página">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.visitasPorRota} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="rota" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="n" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="De onde vêm os visitantes">
              <Table
                cols={["Origem", "Visitas"]}
                rows={data.referrers.map((r) => [r.fonte, r.n])}
              />
            </Card>
          </div>

          <Card title="Funil de conversão por landing">
            <Table
              cols={["Página", "Visitas", "Scroll 50%", "CTA clicado", "Iniciou form", "Enviou form", "Conv."]}
              rows={data.funil.map((f) => [
                f.rota,
                f.views,
                pct(f.scroll50, f.views),
                pct(f.cta, f.views),
                pct(f.formStart, f.views),
                pct(f.formSubmit, f.views),
                f.views ? `${((f.formSubmit / f.views) * 100).toFixed(1)}%` : "—",
              ])}
            />
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card title="CTAs mais clicados">
              <Table cols={["CTA", "Cliques"]} rows={data.ctasTop.map((c) => [c.cta, c.n])} />
            </Card>
            <Card title="UTM sources (campanhas)">
              {data.utmSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma visita com UTM no período.</p>
              ) : (
                <Table cols={["Source", "Visitas"]} rows={data.utmSources.map((u) => [u.source, u.n])} />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function pct(n: number, total: number) {
  if (!total) return "—";
  return `${n} (${((n / total) * 100).toFixed(0)}%)`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {cols.map((c) => (
              <th key={c} className="text-left py-2 px-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="py-4 text-center text-muted-foreground text-sm">Sem dados ainda.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="py-2 px-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
