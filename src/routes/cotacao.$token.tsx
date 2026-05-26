import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/cotacao/$token")({
  head: () => ({ meta: [{ title: "Cotação — Portal do Fornecedor" }] }),
  component: PortalFornecedor,
});

type Item = { descricao: string; qtd: number; unidade: string };

function PortalFornecedor() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ pdf_url: string } | null>(null);

  const [form, setForm] = useState({
    razao_social: "",
    cnpj: "",
    email: "",
    telefone: "",
    representante_legal: "",
    cpf_representante: "",
    endereco: "",
    observacao: "",
    validade_dias: 30,
  });
  const [respostas, setRespostas] = useState<Array<{ precoUnitario: number; indisponivel: boolean }>>([]);

  useEffect(() => {
    fetch(`/api/public/cotacao/${token}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.convite) {
          setForm((f) => ({
            ...f,
            razao_social: d.convite.razao_social ?? "",
            cnpj: d.convite.cnpj ?? "",
            email: d.convite.email ?? "",
            telefone: d.convite.telefone ?? "",
            representante_legal: d.convite.representante_legal ?? "",
            cpf_representante: d.convite.cpf_representante ?? "",
            endereco: d.convite.endereco ?? "",
          }));
        }
        if (d.cotacao?.itens) {
          setRespostas((d.cotacao.itens as Item[]).map(() => ({ precoUnitario: 0, indisponivel: false })));
        }
        if (d.status === "preenchido") {
          setSubmitted({ pdf_url: `/api/public/cotacao/${token}/pdf` });
        }
      })
      .catch(() => toast.error("Não foi possível carregar o convite"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!data || data.status === "expirado") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Convite indisponível</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Este link expirou ou não é válido. Solicite um novo convite ao solicitante.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cot = data.cotacao;
  const itens = (cot?.itens ?? []) as Item[];

  async function submeter() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/cotacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, respostas }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
      const r = await res.json();
      setSubmitted({ pdf_url: r.pdf_url });
      toast.success("Orçamento enviado!");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Orçamento enviado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Obrigado! Baixe abaixo o PDF do orçamento para imprimir, assinar e carimbar em sua unidade.
            </p>
            <a href={submitted.pdf_url} target="_blank" rel="noreferrer" download>
              <Button className="w-full gap-2">
                <Download className="h-4 w-4" /> Baixar PDF do orçamento
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Portal do Fornecedor</p>
          <h1 className="text-2xl font-semibold">Cotação: {cot?.objeto}</h1>
          {cot?.termo && <p className="text-sm text-muted-foreground">Termo: {cot.termo}</p>}
        </header>

        <Card>
          <CardHeader><CardTitle className="text-base">Seus dados</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Razão social" v={form.razao_social} on={(v) => setForm({ ...form, razao_social: v })} />
            <Field label="CNPJ" v={form.cnpj} on={(v) => setForm({ ...form, cnpj: v })} />
            <Field label="E-mail" v={form.email} on={(v) => setForm({ ...form, email: v })} />
            <Field label="Telefone" v={form.telefone} on={(v) => setForm({ ...form, telefone: v })} />
            <Field label="Representante legal" v={form.representante_legal} on={(v) => setForm({ ...form, representante_legal: v })} />
            <Field label="CPF do representante" v={form.cpf_representante} on={(v) => setForm({ ...form, cpf_representante: v })} />
            <div className="sm:col-span-2">
              <Field label="Endereço" v={form.endereco} on={(v) => setForm({ ...form, endereco: v })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Itens ({itens.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {itens.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-3 items-center border-b pb-2 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i + 1}. {it.descricao}</div>
                  <div className="text-xs text-muted-foreground">{it.qtd} {it.unidade}</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Preço unitário"
                  disabled={respostas[i]?.indisponivel}
                  value={respostas[i]?.precoUnitario ?? 0}
                  onChange={(e) => {
                    const arr = [...respostas];
                    arr[i] = { ...arr[i], precoUnitario: Number(e.target.value) || 0 };
                    setRespostas(arr);
                  }}
                />
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={respostas[i]?.indisponivel ?? false}
                    onCheckedChange={(v) => {
                      const arr = [...respostas];
                      arr[i] = { ...arr[i], indisponivel: !!v, precoUnitario: v ? 0 : arr[i].precoUnitario };
                      setRespostas(arr);
                    }}
                  />
                  Não temos
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Validade da proposta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={form.validade_dias}
                  onChange={(e) => setForm({ ...form, validade_dias: Number(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                rows={3}
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" disabled={submitting} onClick={submeter}>
            {submitting ? "Enviando..." : "Enviar orçamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
