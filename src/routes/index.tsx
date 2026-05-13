import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Upload, Download, Plus, Trash2, FileText, CheckCircle2, AlertCircle, Save, Copy, RotateCcw, Cloud, CloudDownload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  salvarExtracaoOnline,
  listarExtracoesOnline,
  carregarExtracaoOnline,
  apagarExtracaoOnline,
  type ExtracaoSalvaResumo,
} from "@/lib/extracoes-online";
import {
  CATEGORIAS,
  CATEGORIA_GASTO_BASELINE,
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

const STORAGE_KEY = "sit-tcepr-state-v1";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const today = () => new Date().toISOString().slice(0, 10);

// Sanitizadores espelhados de src/lib/sit/formatLinha.ts
const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const cleanText = (s: string) =>
  stripDiacritics((s ?? "").replace(/[|"'\\\r\n]/g, " ").replace(/\s+/g, " ").trim());
const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const sanitizeId = (s: string) => (s ?? "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 30);
const limiteDocFav = (tp: "CPF" | "CNPJ" | "EXT") => (tp === "CPF" ? 11 : tp === "CNPJ" ? 14 : 20);
const sanitizeNrDocFav = (s: string, tp: "CPF" | "CNPJ" | "EXT") =>
  tp === "EXT" ? truncate(cleanText(s), 20) : truncate(onlyDigits(s), limiteDocFav(tp));

/**
 * Input numérico que mantém um draft em string. Resolve o bug de
 * "não consigo apagar o zero" / "perde a vírgula no meio da digitação".
 * Aceita "," e ".", só comita o número quando o draft é válido.
 */
function NumberField({
  value,
  onChange,
  className,
  align = "left",
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const [draft, setDraft] = useState<string>(() => String(value ?? 0));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? 0));
  }, [value]);
  return (
    <Input
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        const norm = v.replace(/\./g, "").replace(",", ".");
        const n = Number(norm);
        if (v.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        const norm = draft.replace(/\./g, "").replace(",", ".");
        const n = Number(norm);
        const final = Number.isFinite(n) ? n : 0;
        onChange(final);
        setDraft(String(final));
      }}
      className={`${className ?? ""} ${align === "right" ? "text-right" : ""}`}
    />
  );
}

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

type CategoriaOverride = { previsto?: number; gasto?: number; saldo?: number };
type CategoriaExtra = { codigo: string; nome: string; previsto: number };

async function copyTSV(rows: (string | number)[][], label: string) {
  const fmt = (v: string | number) =>
    String(v ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const tsv = rows.map((r) => r.map(fmt).join("\t")).join("\n");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(tsv);
    } else {
      const ta = document.createElement("textarea");
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success(`${label} copiada (${rows.length - 1} linha(s)).`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

const fmtNum = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [overrides, setOverrides] = useState<Record<string, CategoriaOverride>>({});
  const [categoriasExtras, setCategoriasExtras] = useState<CategoriaExtra[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [salvandoOnline, setSalvandoOnline] = useState(false);
  const [carregarAberto, setCarregarAberto] = useState(false);
  const [listaOnline, setListaOnline] = useState<ExtracaoSalvaResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          mesRef?: string;
          receitas?: ReceitaExtraida[];
          despesas?: Despesa[];
          resumo?: typeof resumo;
          overrides?: Record<string, CategoriaOverride>;
          categoriasExtras?: CategoriaExtra[];
        };
        if (s.mesRef) setMesRef(s.mesRef);
        if (s.receitas) setReceitas(s.receitas);
        if (s.despesas) setDespesas(s.despesas);
        if (s.resumo) setResumo(s.resumo);
        if (s.overrides) setOverrides(s.overrides);
        if (s.categoriasExtras) setCategoriasExtras(s.categoriasExtras);
      }
    } catch {
      /* noop */
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mesRef, receitas, despesas, resumo, overrides, categoriasExtras }),
      );
    } catch {
      /* noop */
    }
  }, [hidratado, mesRef, receitas, despesas, resumo, overrides, categoriasExtras]);

  function salvarManual() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mesRef, receitas, despesas, resumo, overrides, categoriasExtras }),
    );
    toast.success(`Lançamentos salvos (${despesas.length} despesa(s)).`);
  }

  function limparTudo() {
    if (!window.confirm("Apagar todos os lançamentos salvos?")) return;
    setMesRef("");
    setReceitas([]);
    setDespesas([]);
    setResumo({ saldoAnterior: 0, transferidos: 0, rendimentos: 0, estornados: 0 });
    setOverrides({});
    setCategoriasExtras([]);
    window.localStorage.removeItem(STORAGE_KEY);
    toast.success("Lançamentos apagados.");
  }

  function aplicarExtracao(data: ExtracaoResultado) {
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
  }

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
      aplicarExtracao(data);
      toast.success(`Extraídas ${data.despesas?.length ?? 0} despesas.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtraindo(false);
    }
  }

  function buildExtracaoAtual(): ExtracaoResultado {
    return {
      mesReferencia: mesRef,
      receitas,
      resumo,
      despesas: despesas.map((d) => ({
        idInterno: d.idInterno,
        data: d.data,
        dataEmissao: d.dataEmissao || null,
        favorecido: d.favorecido,
        documento: d.documento,
        valor: Number(d.valor) || 0,
        tipoDocumento: d.tipoDocumento,
        subtipoDocumento: d.subtipoDocumento ?? null,
        tpDocFav: d.tpDocFav,
        nrDocFav: d.nrDocFav,
        descricao: d.descricao,
        sugestaoCategoria: d.categoria,
      })),
    } as ExtracaoResultado;
  }

  async function salvarOnline() {
    if (despesas.length === 0 && receitas.length === 0) {
      toast.error("Nada para salvar online.");
      return;
    }
    setSalvandoOnline(true);
    try {
      await salvarExtracaoOnline({
        dados: buildExtracaoAtual(),
        nomeArquivo: mesRef ? `extracao-${mesRef.replace("/", "-")}` : null,
      });
      toast.success("Extração salva online.");
    } catch (e) {
      toast.error("Falha ao salvar online: " + (e as Error).message);
    } finally {
      setSalvandoOnline(false);
    }
  }

  async function abrirCarregarOnline() {
    setCarregarAberto(true);
    setCarregandoLista(true);
    try {
      setListaOnline(await listarExtracoesOnline());
    } catch (e) {
      toast.error("Falha ao listar: " + (e as Error).message);
    } finally {
      setCarregandoLista(false);
    }
  }

  async function carregarItem(id: string) {
    try {
      const data = await carregarExtracaoOnline(id);
      aplicarExtracao(data);
      setCarregarAberto(false);
      toast.success("Extração carregada.");
    } catch (e) {
      toast.error("Falha ao carregar: " + (e as Error).message);
    }
  }

  async function apagarItem(id: string) {
    if (!window.confirm("Apagar esta extração online?")) return;
    try {
      await apagarExtracaoOnline(id);
      setListaOnline((prev) => prev.filter((x) => x.id !== id));
      toast.success("Apagada.");
    } catch (e) {
      toast.error("Falha ao apagar: " + (e as Error).message);
    }
  }

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
  const algumDado =
    despesas.length > 0 ||
    receitas.length > 0 ||
    Object.keys(overrides).length > 0 ||
    categoriasExtras.length > 0;

  const todasCategorias = useMemo(
    () => [
      ...CATEGORIAS.map((c) => ({ codigo: c.codigo, nome: c.nome, previsto: c.previsto })),
      ...categoriasExtras,
    ],
    [categoriasExtras],
  );

  function copyReceitas() {
    const rows: (string | number)[][] = [["Parcela", "Data", "Valor"]];
    receitas.forEach((r, i) =>
      rows.push([r.numeroParcela ?? i + 1, r.dataRecebimento, fmtNum(r.valor)]),
    );
    copyTSV(rows, "Tabela Receitas");
  }
  function copyDespesas() {
    const rows: (string | number)[][] = [
      ["Data", "Favorecido", "Documento", "Tipo", "CPF/CNPJ", "Categoria", "Valor"],
    ];
    despesas.forEach((d) => {
      const cat = todasCategorias.find((c) => c.codigo === d.categoria);
      const tipo = TIPOS_DOCUMENTO.find((t) => t.codigo === d.tipoDocumento);
      rows.push([
        d.data,
        d.favorecido,
        d.documento,
        tipo ? `${tipo.codigo} — ${tipo.nome}` : String(d.tipoDocumento),
        `${d.tpDocFav} ${d.nrDocFav}`,
        cat ? `${cat.codigo} — ${cat.nome}` : d.categoria,
        fmtNum(d.valor),
      ]);
    });
    copyTSV(rows, "Tabela Despesas");
  }
  function copyCategorias() {
    const rows: (string | number)[][] = [["Código", "Descrição", "Previsto", "Gasto", "Saldo"]];
    let tp = 0,
      tg = 0,
      ts = 0;
    todasCategorias.forEach((c) => {
      const o = overrides[c.codigo] ?? {};
      const previsto = o.previsto ?? c.previsto;
      const gastoCalc = (CATEGORIA_GASTO_BASELINE[c.codigo] ?? 0) + (gastoPorCategoria.get(c.codigo) ?? 0);
      const gasto = o.gasto ?? gastoCalc;
      const saldo = o.saldo ?? previsto - gasto;
      tp += previsto;
      tg += gasto;
      ts += saldo;
      rows.push([c.codigo, c.nome, fmtNum(previsto), fmtNum(gasto), fmtNum(saldo)]);
    });
    rows.push(["", "TOTAL", fmtNum(tp), fmtNum(tg), fmtNum(ts)]);
    copyTSV(rows, "Tabela Execução Orçamentária");
  }

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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={salvarManual} disabled={!algumDado} className="gap-2">
              <Save className="h-4 w-4" /> Salvar
            </Button>
            <Button variant="ghost" onClick={limparTudo} disabled={!algumDado} className="gap-2">
              <Trash2 className="h-4 w-4" /> Limpar
            </Button>
            <Button onClick={exportarTxt} disabled={!algumDado} className="gap-2">
              <Download className="h-4 w-4" /> Exportar .TXT
            </Button>
          </div>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Valores transferidos</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyReceitas}
                  disabled={receitas.length === 0}
                  className="gap-1"
                >
                  <Copy className="h-4 w-4" /> Copiar tabela
                </Button>
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
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyDespesas}
                    disabled={despesas.length === 0}
                    className="gap-1"
                  >
                    <Copy className="h-4 w-4" /> Copiar tabela
                  </Button>
                  <Button size="sm" variant="outline" onClick={adicionarDespesa} className="gap-1">
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <DespesasTable
                  despesas={despesas}
                  onUpdate={updateDespesa}
                  onRemove={removerDespesa}
                  categorias={todasCategorias}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categorias">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Saldo atualizado por categoria econômica
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyCategorias}
                  className="gap-1"
                >
                  <Copy className="h-4 w-4" /> Copiar tabela
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <CategoriasTable
                  gasto={gastoPorCategoria}
                  overrides={overrides}
                  setOverrides={setOverrides}
                  extras={categoriasExtras}
                  setExtras={setCategoriasExtras}
                />
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
              <>
                <NumberField
                  value={resumo[c.key]}
                  onChange={(n) => onChange({ ...resumo, [c.key as string]: n })}
                  className="mt-1 h-8 px-2 text-base font-semibold"
                />
                <div className="mt-1 text-xs text-muted-foreground">{fmtBRL(resumo[c.key])}</div>
              </>
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
  categorias,
}: {
  despesas: Despesa[];
  onUpdate: (uid: string, patch: Partial<Despesa>) => void;
  onRemove: (uid: string) => void;
  categorias: { codigo: string; nome: string; previsto: number }[];
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
    <div className="space-y-3">
      {despesas.map((d) => {
        const precisaSub = TIPOS_COM_SUBTIPO.has(d.tipoDocumento);
        const cat = categorias.find((c) => c.codigo === d.categoria);
        const completa =
          d.idInterno.trim() !== "" &&
          d.data.trim() !== "" &&
          d.favorecido.trim() !== "" &&
          d.descricao.trim() !== "" &&
          d.nrDocFav.trim() !== "" &&
          d.documento.trim() !== "" &&
          d.valor > 0 &&
          !!d.tipoDocumento &&
          (!precisaSub || d.subtipoDocumento != null) &&
          d.categoria.trim() !== "";
        return (
          <Card
            key={d.uid}
            className={`border-[1px] ${completa ? "border-emerald-500" : "border-amber-500"}`}
          >
            <CardContent className="p-4">
              <div className="grid grid-cols-12 gap-3">
                {/* linha 1: ID + Data + remover */}
                <div className="col-span-3 md:col-span-2">
                  <Label className="mb-1 block text-xs text-muted-foreground">ID</Label>
                  <Input
                    value={d.idInterno}
                    maxLength={30}
                    onChange={(e) => onUpdate(d.uid, { idInterno: sanitizeId(e.target.value) })}
                    onBlur={(e) => onUpdate(d.uid, { idInterno: sanitizeId(e.target.value) })}
                    className="h-10 text-sm border-[0.5px] border-black"
                  />
                </div>
                <div className="col-span-7 md:col-span-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Data pgto</Label>
                  <Input
                    type="date"
                    value={d.data}
                    onChange={(e) => onUpdate(d.uid, { data: e.target.value })}
                    className="h-10 text-sm border-[0.5px] border-black"
                  />
                </div>
                <div className="col-span-2 md:col-span-7 flex items-end justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemove(d.uid)}
                    className="h-10 w-10"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* linha 2: Favorecido full width */}
                <div className="col-span-12">
                  <Label className="mb-1 block text-xs text-muted-foreground">Favorecido</Label>
                  <Input
                    value={d.favorecido}
                    maxLength={100}
                    onChange={(e) => onUpdate(d.uid, { favorecido: e.target.value })}
                    onBlur={(e) => onUpdate(d.uid, { favorecido: truncate(cleanText(e.target.value), 100) })}
                    className="h-10 text-sm border-[0.5px] border-black"
                  />
                </div>

                {/* linha 3: Descrição full width */}
                <div className="col-span-12">
                  <Label className="mb-1 block text-xs text-muted-foreground">Descrição</Label>
                  <Input
                    value={d.descricao}
                    placeholder="Descrição do gasto"
                    maxLength={1000}
                    onChange={(e) => onUpdate(d.uid, { descricao: e.target.value })}
                    onBlur={(e) => onUpdate(d.uid, { descricao: truncate(cleanText(e.target.value), 1000) })}
                    className="h-10 text-sm border-[0.5px] border-black"
                  />
                </div>

                {/* linha 4: Tp + CPF/CNPJ, Tipo, Subtipo */}
                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-1 block text-xs text-muted-foreground">CPF/CNPJ</Label>
                  <div className="flex gap-2">
                    <Select
                      value={d.tpDocFav}
                      onValueChange={(v) => {
                        const tp = v as Despesa["tpDocFav"];
                        onUpdate(d.uid, { tpDocFav: tp, nrDocFav: sanitizeNrDocFav(d.nrDocFav, tp) });
                      }}
                    >
                      <SelectTrigger className="h-10 w-[88px] text-sm border-[0.5px] border-black">
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
                      maxLength={limiteDocFav(d.tpDocFav)}
                      inputMode={d.tpDocFav === "EXT" ? "text" : "numeric"}
                      onChange={(e) => onUpdate(d.uid, { nrDocFav: sanitizeNrDocFav(e.target.value, d.tpDocFav) })}
                      onBlur={(e) => onUpdate(d.uid, { nrDocFav: sanitizeNrDocFav(e.target.value, d.tpDocFav) })}
                      className="h-10 text-sm border-[0.5px] border-black"
                    />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-1 block text-xs text-muted-foreground">Tipo de documento</Label>
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
                    <SelectTrigger className="h-10 text-sm border-[0.5px] border-black">
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
                </div>

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-1 block text-xs text-muted-foreground">Subtipo</Label>
                  {precisaSub ? (
                    <Select
                      value={String(d.subtipoDocumento ?? "")}
                      onValueChange={(v) => onUpdate(d.uid, { subtipoDocumento: Number(v) })}
                    >
                      <SelectTrigger className="h-10 text-sm border-[0.5px] border-black">
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
                    <div className="flex h-10 items-center text-sm text-muted-foreground">—</div>
                  )}
                </div>

                {/* linha 5: Doc nº, Categoria (largo), Valor */}
                <div className="col-span-12 md:col-span-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Doc nº</Label>
                  <Input
                    value={d.documento}
                    maxLength={20}
                    onChange={(e) => onUpdate(d.uid, { documento: e.target.value })}
                    onBlur={(e) => onUpdate(d.uid, { documento: truncate(cleanText(e.target.value), 20) })}
                    className="h-10 text-sm border-[0.5px] border-black"
                  />
                </div>

                <div className="col-span-12 md:col-span-6">
                  <Label className="mb-1 block text-xs text-muted-foreground">Categoria 2.4</Label>
                  <Select
                    value={d.categoria}
                    onValueChange={(v) => onUpdate(d.uid, { categoria: v })}
                  >
                    <SelectTrigger className="h-auto min-h-12 py-2 text-left border-[0.5px] border-black">
                      <SelectValue asChild>
                        <div className="flex flex-col gap-0.5 leading-tight">
                          <span className="font-mono text-xs">{cat?.codigo ?? d.categoria}</span>
                          <span className="text-sm">{cat?.nome ?? "—"}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {categorias.map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>
                          <span className="font-mono text-xs">{c.codigo}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.nome}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Valor (R$)</Label>
                  <NumberField
                    value={d.valor}
                    onChange={(n) => onUpdate(d.uid, { valor: n })}
                    className="h-10 text-sm border-[0.5px] border-black"
                    align="right"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CategoriasTable({
  gasto,
  overrides,
  setOverrides,
  extras,
  setExtras,
}: {
  gasto: Map<string, number>;
  overrides: Record<string, CategoriaOverride>;
  setOverrides: (
    upd:
      | Record<string, CategoriaOverride>
      | ((prev: Record<string, CategoriaOverride>) => Record<string, CategoriaOverride>),
  ) => void;
  extras: CategoriaExtra[];
  setExtras: (
    upd: CategoriaExtra[] | ((prev: CategoriaExtra[]) => CategoriaExtra[]),
  ) => void;
}) {
  const linhas = [
    ...CATEGORIAS.map((c) => ({ codigo: c.codigo, nome: c.nome, previsto: c.previsto, extra: false })),
    ...extras.map((c) => ({ ...c, extra: true })),
  ];

  function patchOverride(codigo: string, patch: Partial<CategoriaOverride>) {
    setOverrides((prev) => {
      const cur = { ...(prev[codigo] ?? {}), ...patch };
      // limpa undefineds
      (Object.keys(cur) as (keyof CategoriaOverride)[]).forEach((k) => {
        if (cur[k] === undefined) delete cur[k];
      });
      const next = { ...prev };
      if (Object.keys(cur).length === 0) delete next[codigo];
      else next[codigo] = cur;
      return next;
    });
  }

  function resetSaldo(codigo: string) {
    patchOverride(codigo, { saldo: undefined });
  }
  function resetGasto(codigo: string) {
    patchOverride(codigo, { gasto: undefined });
  }

  // form de nova categoria
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoPrevisto, setNovoPrevisto] = useState(0);

  function adicionarCategoria() {
    if (!novoCodigo.trim() || !novoNome.trim()) {
      toast.error("Informe código e descrição da categoria.");
      return;
    }
    if (
      CATEGORIAS.some((c) => c.codigo === novoCodigo) ||
      extras.some((c) => c.codigo === novoCodigo)
    ) {
      toast.error("Código já existe.");
      return;
    }
    setExtras((prev) => [...prev, { codigo: novoCodigo.trim(), nome: novoNome.trim(), previsto: novoPrevisto }]);
    setNovoCodigo("");
    setNovoNome("");
    setNovoPrevisto(0);
  }

  function removerExtra(codigo: string) {
    setExtras((prev) => prev.filter((c) => c.codigo !== codigo));
    patchOverride(codigo, { previsto: undefined, gasto: undefined, saldo: undefined });
  }

  let tp = 0,
    tg = 0,
    ts = 0;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">Código</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="w-[150px] text-right">Previsto</TableHead>
          <TableHead className="w-[170px] text-right">Gasto</TableHead>
          <TableHead className="w-[170px] text-right">Saldo</TableHead>
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((c) => {
          const o = overrides[c.codigo] ?? {};
          const previsto = o.previsto ?? c.previsto;
          const gastoCalc = (CATEGORIA_GASTO_BASELINE[c.codigo] ?? 0) + (gasto.get(c.codigo) ?? 0);
          const gastoEfetivo = o.gasto ?? gastoCalc;
          const saldoCalc = previsto - gastoEfetivo;
          const saldoEfetivo = o.saldo ?? saldoCalc;
          const estourou = saldoEfetivo < 0;
          tp += previsto;
          tg += gastoEfetivo;
          ts += saldoEfetivo;
          return (
            <TableRow key={c.codigo} className={estourou ? "bg-destructive/5" : ""}>
              <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
              <TableCell>{c.nome}</TableCell>
              <TableCell>
                <NumberField
                  value={previsto}
                  onChange={(n) =>
                    patchOverride(c.codigo, {
                      previsto: n === c.previsto && !c.extra ? undefined : n,
                    })
                  }
                  className="h-8 px-2"
                  align="right"
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <NumberField
                    value={gastoEfetivo}
                    onChange={(n) =>
                      patchOverride(c.codigo, { gasto: n === gastoCalc ? undefined : n })
                    }
                    className="h-8 px-2"
                    align="right"
                  />
                  {o.gasto !== undefined && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => resetGasto(c.codigo)}
                      aria-label="Voltar ao calculado"
                      title="Voltar ao gasto calculado"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <NumberField
                    value={saldoEfetivo}
                    onChange={(n) =>
                      patchOverride(c.codigo, { saldo: n === saldoCalc ? undefined : n })
                    }
                    className="h-8 px-2"
                    align="right"
                  />
                  {o.saldo !== undefined && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => resetSaldo(c.codigo)}
                      aria-label="Voltar ao calculado"
                      title="Voltar ao saldo calculado"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {c.extra ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removerExtra(c.codigo)}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : estourou ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : gastoEfetivo > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/30">
          <TableCell>
            <Input
              value={novoCodigo}
              placeholder="ex 3.3.90.30.99"
              onChange={(e) => setNovoCodigo(e.target.value)}
              className="h-8 px-2 font-mono text-xs"
            />
          </TableCell>
          <TableCell>
            <Input
              value={novoNome}
              placeholder="Descrição da nova categoria"
              onChange={(e) => setNovoNome(e.target.value)}
              className="h-8 px-2"
            />
          </TableCell>
          <TableCell>
            <NumberField
              value={novoPrevisto}
              onChange={setNovoPrevisto}
              className="h-8 px-2"
              align="right"
            />
          </TableCell>
          <TableCell colSpan={2} />
          <TableCell>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={adicionarCategoria}
              aria-label="Adicionar categoria"
              title="Adicionar categoria"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
        <TableRow className="border-t-2 font-semibold">
          <TableCell colSpan={2}>TOTAL</TableCell>
          <TableCell className="text-right">{fmtBRL(tp)}</TableCell>
          <TableCell className="text-right">{fmtBRL(tg)}</TableCell>
          <TableCell className="text-right">{fmtBRL(ts)}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}
