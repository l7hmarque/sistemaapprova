import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Download, Plus, Trash2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import {
  CATEGORIAS,
  SUBTIPOS_DOCUMENTO,
  TIPOS_COM_SUBTIPO,
  TIPOS_DOCUMENTO,
} from "@/lib/sit/catalogos";
import { formatLinhaSIT } from "@/lib/sit/formatLinha";
import { encodeWin1252 } from "@/lib/sit/ansiEncode";
import type { ExtracaoResultado, ReceitaExtraida } from "@/lib/extract/schema";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIT — Prestação de Contas TCE-PR" },
      {
        name: "description",
        content:
          "Importe PDFs de prestação de contas e gere o arquivo Despesa.txt no padrão SIT do TCE-PR com revisão assistida por IA.",
      },
    ],
  }),
  component: AppPage,
});

type Despesa = {
  uid: string;
  idInterno: string;
  data: string;
  dataEmissao: string;
  favorecido: string;
  documento: string;
  valor: number;
  tipoDocumento: number;
  subtipoDocumento: number | null;
  tpDocFav: "CPF" | "CNPJ" | "EXT";
  nrDocFav: string;
  descricao: string;
  categoria: string;
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const today = () => new Date().toISOString().slice(0, 10);

function novaDespesa(): Despesa {
  return {
    uid: crypto.randomUUID(),
    idInterno: `ext-${Math.floor(Math.random() * 100000)}`,
    data: today(),
    dataEmissao: today(),
    favorecido: "",
    documento: "0",
    valor: 0,
    tipoDocumento: 1,
    subtipoDocumento: null,
    tpDocFav: "CNPJ",
    nrDocFav: "",
    descricao: "",
    categoria: CATEGORIAS[0].codigo,
  };
}

function AppPage() {
  const [extraindo, setExtraindo] = useState(false);
  const [mesRef, setMesRef] = useState("");
  const [receitas, setReceitas] = useState<ReceitaExtraida[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [resumo, setResumo] = useState({
    saldoAnterior: 0,
    transferidos: 0,
    rendimentos: 0,
    estornados: 0,
  });

  async function handleUpload(file: File) {
    setExtraindo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Erro ${res.status}`);
      }
      const data = (await res.json()) as ExtracaoResultado;
      setMesRef(data.mesReferencia ?? "");
      setReceitas(data.receitas ?? []);
      setResumo({
        saldoAnterior: data.resumo?.saldoAnterior ?? 0,
        transferidos: data.resumo?.transferidos ?? 0,
        rendimentos: data.resumo?.rendimentos ?? 0,
        estornados: data.resumo?.estornados ?? 0,
      });
      setDespesas(
        (data.despesas ?? []).map((d) => ({
          uid: crypto.randomUUID(),
          idInterno: d.idInterno,
          data: d.data,
          dataEmissao: d.dataEmissao || d.data,
          favorecido: d.favorecido,
          documento: d.documento || "0",
          valor: Number(d.valor) || 0,
          tipoDocumento: d.tipoDocumento,
          subtipoDocumento: d.subtipoDocumento ?? null,
          tpDocFav: (d.tpDocFav === "CNPJ" || d.tpDocFav === "EXT" ? d.tpDocFav : "CPF") as Despesa["tpDocFav"],
          nrDocFav: d.nrDocFav,
          descricao: d.descricao,
          categoria: d.sugestaoCategoria || CATEGORIAS[0].codigo,
        })),
      );
      toast.success(`Extraídas ${data.despesas?.length ?? 0} despesas.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtraindo(false);
    }
  }

  const totalExecutado = useMemo(
    () => despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0),
    [despesas],
  );
  const saldoMes =
    resumo.saldoAnterior +
    resumo.transferidos +
    resumo.rendimentos -
    resumo.estornados -
    totalExecutado;

  const gastoPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of despesas) {
      m.set(d.categoria, (m.get(d.categoria) ?? 0) + (Number(d.valor) || 0));
    }
    return m;
  }, [despesas]);

  function updateDespesa(uid: string, patch: Partial<Despesa>) {
    setDespesas((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  }
  function removerDespesa(uid: string) {
    setDespesas((prev) => prev.filter((d) => d.uid !== uid));
  }
  function adicionarDespesa() {
    setDespesas((prev) => [...prev, novaDespesa()]);
  }

  function exportarTxt() {
    if (despesas.length === 0) {
      toast.error("Adicione ao menos uma despesa antes de exportar.");
      return;
    }
    const erros: string[] = [];
    const linhas = despesas.map((d, i) => {
      if (!d.favorecido.trim()) erros.push(`Linha ${i + 1}: favorecido vazio.`);
      if (!d.nrDocFav.trim()) erros.push(`Linha ${i + 1}: documento do favorecido vazio.`);
      if (!d.data) erros.push(`Linha ${i + 1}: data de pagamento vazia.`);
      if (TIPOS_COM_SUBTIPO.has(d.tipoDocumento) && d.subtipoDocumento == null) {
        erros.push(`Linha ${i + 1}: subtipo obrigatório para tipo ${d.tipoDocumento}.`);
      }
      return formatLinhaSIT(
        {
          dtDespesa: d.data,
          vlDespesa: d.valor,
          cdTipoDocumentoDespesa: d.tipoDocumento,
          cdSubtipoDocumentoDespesa: d.subtipoDocumento ?? null,
          nrDocumentoDespesa: d.documento,
          dtEmissaoDocumentoDespesa: d.dataEmissao || d.data,
          tpDocumentoFavorecido: d.tpDocFav,
          nrDocumentoFavorecido: d.nrDocFav,
          nmFavorecido: d.favorecido,
          dsObjetoDespesa: d.descricao,
        },
        i + 1,
        d.idInterno || i + 1,
      );
    });
    if (erros.length) {
      toast.error(`${erros.length} pendência(s) na revisão`, {
        description: erros.slice(0, 4).join(" • "),
      });
      return;
    }
    const conteudo = linhas.join("\r\n") + "\r\n";
    const bytes = encodeWin1252(conteudo);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Despesa.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Despesa.txt gerado com ${linhas.length} linha(s).`);
  }

  const fechaMatematica = Math.abs(saldoMes - (saldoMes | 0)) >= 0; // sempre verdadeiro; usado só para tipagem
  const algumDado = despesas.length > 0 || receitas.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              SIT — Prestação de Contas
            </h1>
            <p className="text-xs text-muted-foreground">
              TCE-PR · Importação Despesa.txt {mesRef && `· ${mesRef}`}
            </p>
          </div>
          <Button onClick={exportarTxt} disabled={!algumDado} className="gap-2">
            <Download className="h-4 w-4" /> Exportar .TXT
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <UploadCard onFile={handleUpload} loading={extraindo} />

        <ResumoCards
          resumo={resumo}
          totalExecutado={totalExecutado}
          saldoMes={saldoMes}
          onChange={setResumo}
        />

        <Tabs defaultValue="despesas" className="w-full">
          <TabsList>
            <TabsTrigger value="receitas">Receitas (1.1)</TabsTrigger>
            <TabsTrigger value="despesas">Despesas (1.2)</TabsTrigger>
            <TabsTrigger value="categorias">Execução Orçamentária (2.4)</TabsTrigger>
          </TabsList>

          <TabsContent value="receitas">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Valores transferidos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receitas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Nenhuma receita extraída ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {receitas.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.numeroParcela ?? i + 1}</TableCell>
                        <TableCell>{r.dataRecebimento}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="despesas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Despesas efetuadas no mês ({despesas.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={adicionarDespesa} className="gap-1">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <DespesasTable
                  despesas={despesas}
                  onUpdate={updateDespesa}
                  onRemove={removerDespesa}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categorias">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Saldo atualizado por categoria econômica
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <CategoriasTable gasto={gastoPorCategoria} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {!fechaMatematica && null}
      </main>
    </div>
  );
}

function UploadCard({
  onFile,
  loading,
}: {
  onFile: (f: File) => void;
  loading: boolean;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <Card>
      <CardContent className="p-6">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            drag ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="font-medium">
            {loading ? "Extraindo dados com IA…" : "Arraste o PDF de Despesas aqui"}
          </div>
          <div className="text-sm text-muted-foreground">
            ou clique para selecionar (holerites, NFs, boletos, comprovantes)
          </div>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}

function ResumoCards({
  resumo,
  totalExecutado,
  saldoMes,
  onChange,
}: {
  resumo: { saldoAnterior: number; transferidos: number; rendimentos: number; estornados: number };
  totalExecutado: number;
  saldoMes: number;
  onChange: (
    r: { saldoAnterior: number; transferidos: number; rendimentos: number; estornados: number },
  ) => void;
}) {
  const cards: { label: string; value: number; key?: keyof typeof resumo; tone?: string }[] = [
    { label: "Saldo Anterior", value: resumo.saldoAnterior, key: "saldoAnterior" },
    { label: "Valores Transferidos", value: resumo.transferidos, key: "transferidos" },
    { label: "Rendimentos", value: resumo.rendimentos, key: "rendimentos" },
    { label: "Valores Estornados", value: resumo.estornados, key: "estornados" },
    { label: "Valor Executado", value: totalExecutado, tone: "text-primary" },
    {
      label: "Saldo Próximo Mês",
      value: saldoMes,
      tone: saldoMes >= 0 ? "text-emerald-600" : "text-destructive",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {c.label}
            </div>
            {c.key ? (
              <Input
                type="number"
                step="0.01"
                value={resumo[c.key]}
                onChange={(e) =>
                  onChange({ ...resumo, [c.key as string]: Number(e.target.value) || 0 })
                }
                className="mt-1 h-8 px-2 text-base font-semibold"
              />
            ) : (
              <div className={`mt-2 text-lg font-semibold ${c.tone ?? ""}`}>
                {fmtBRL(c.value)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DespesasTable({
  despesas,
  onUpdate,
  onRemove,
}: {
  despesas: Despesa[];
  onUpdate: (uid: string, patch: Partial<Despesa>) => void;
  onRemove: (uid: string) => void;
}) {
  if (despesas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <FileText className="h-8 w-8" />
        <div>Nenhuma despesa carregada. Suba um PDF ou adicione manualmente.</div>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[110px]">ID</TableHead>
          <TableHead className="w-[130px]">Data pgto</TableHead>
          <TableHead>Favorecido</TableHead>
          <TableHead className="w-[150px]">CPF/CNPJ</TableHead>
          <TableHead className="w-[100px]">Tipo</TableHead>
          <TableHead className="w-[110px]">Subtipo</TableHead>
          <TableHead className="w-[110px]">Doc nº</TableHead>
          <TableHead className="w-[170px]">Categoria 2.4</TableHead>
          <TableHead className="w-[120px] text-right">Valor</TableHead>
          <TableHead className="w-[40px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {despesas.map((d) => {
          const precisaSub = TIPOS_COM_SUBTIPO.has(d.tipoDocumento);
          return (
            <TableRow key={d.uid}>
              <TableCell>
                <Input
                  value={d.idInterno}
                  onChange={(e) => onUpdate(d.uid, { idInterno: e.target.value })}
                  className="h-8 px-2"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  value={d.data}
                  onChange={(e) => onUpdate(d.uid, { data: e.target.value })}
                  className="h-8 px-2"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={d.favorecido}
                  onChange={(e) => onUpdate(d.uid, { favorecido: e.target.value })}
                  className="h-8 px-2"
                />
                <Input
                  value={d.descricao}
                  placeholder="Descrição do gasto"
                  onChange={(e) => onUpdate(d.uid, { descricao: e.target.value })}
                  className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Select
                    value={d.tpDocFav}
                    onValueChange={(v) =>
                      onUpdate(d.uid, { tpDocFav: v as Despesa["tpDocFav"] })
                    }
                  >
                    <SelectTrigger className="h-8 w-[70px] px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="EXT">EXT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={d.nrDocFav}
                    onChange={(e) => onUpdate(d.uid, { nrDocFav: e.target.value })}
                    className="h-8 px-2"
                  />
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={String(d.tipoDocumento)}
                  onValueChange={(v) => {
                    const tipo = Number(v);
                    onUpdate(d.uid, {
                      tipoDocumento: tipo,
                      subtipoDocumento: TIPOS_COM_SUBTIPO.has(tipo)
                        ? (d.subtipoDocumento ?? SUBTIPOS_DOCUMENTO[0].codigo)
                        : null,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => (
                      <SelectItem key={t.codigo} value={String(t.codigo)}>
                        {t.codigo} — {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {precisaSub ? (
                  <Select
                    value={String(d.subtipoDocumento ?? "")}
                    onValueChange={(v) =>
                      onUpdate(d.uid, { subtipoDocumento: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-8 px-2">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBTIPOS_DOCUMENTO.map((s) => (
                        <SelectItem key={s.codigo} value={String(s.codigo)}>
                          {s.codigo} — {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Input
                  value={d.documento}
                  onChange={(e) => onUpdate(d.uid, { documento: e.target.value })}
                  className="h-8 px-2"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={d.categoria}
                  onValueChange={(v) => onUpdate(d.uid, { categoria: v })}
                >
                  <SelectTrigger className="h-8 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.codigo} value={c.codigo}>
                        {c.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={d.valor}
                  onChange={(e) => onUpdate(d.uid, { valor: Number(e.target.value) || 0 })}
                  className="h-8 px-2 text-right"
                />
              </TableCell>
              <TableCell>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(d.uid)}
                  className="h-7 w-7"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CategoriasTable({ gasto }: { gasto: Map<string, number> }) {
  const total = CATEGORIAS.reduce(
    (acc, c) => {
      const g = gasto.get(c.codigo) ?? 0;
      acc.previsto += c.previsto;
      acc.gasto += g;
      acc.saldo += c.previsto - g;
      return acc;
    },
    { previsto: 0, gasto: 0, saldo: 0 },
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="text-right">Previsto</TableHead>
          <TableHead className="text-right">Gasto</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead className="w-[40px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {CATEGORIAS.map((c) => {
          const g = gasto.get(c.codigo) ?? 0;
          const saldo = c.previsto - g;
          const estourou = saldo < 0;
          return (
            <TableRow key={c.codigo} className={estourou ? "bg-destructive/5" : ""}>
              <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
              <TableCell>{c.nome}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {fmtBRL(c.previsto)}
              </TableCell>
              <TableCell className="text-right">{fmtBRL(g)}</TableCell>
              <TableCell className="text-right font-medium">{fmtBRL(saldo)}</TableCell>
              <TableCell>
                {estourou ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : g > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="border-t-2 font-semibold">
          <TableCell colSpan={2}>TOTAL</TableCell>
          <TableCell className="text-right">{fmtBRL(total.previsto)}</TableCell>
          <TableCell className="text-right">{fmtBRL(total.gasto)}</TableCell>
          <TableCell className="text-right">{fmtBRL(total.saldo)}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}
