import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listarComprovantes,
  anexarComprovante,
  removerComprovante,
  linkComprovante,
  aprovarComprovante,
  type ComprovanteResumo,
} from "@/lib/comprovantes.functions";
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
import { Upload, Download, Plus, Trash2, FileText, CheckCircle2, AlertCircle, Save, Copy, RotateCcw, Cloud, CloudDownload, Play, X, Loader2, Settings2, ChevronDown, UserPlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  loadRegras,
  saveRegras,
  REGRAS_DEFAULT,
  parseFavorecidosExtras,
  favorecidosExtrasToText,
  aplicarRegrasUsuario,
  type RegrasUsuario,
} from "@/lib/regrasUsuario";
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
  CATEGORIA_TO_TPDESPESA,
  TIPOS_DOC_DESPESA,
  TIPOS_TRANSFERENCIA,
  MODALIDADES_COMPRA,
  TIPOS_DOC_PAGAMENTO,
  FAVORECIDO_OVERRIDES,
  migrarTipoLegacy,
} from "@/lib/sit/catalogos";
import { formatLinhaSIT, type DadosTermo } from "@/lib/sit/formatLinha";
import { isValidCNPJ, isValidCPF } from "@/lib/sit/cnpjValidator";
import { salvarFornecedor, buscarPorCnpj } from "@/lib/fornecedores.functions";
import { encodeWin1252 } from "@/lib/sit/ansiEncode";
import type { ExtracaoResultado, ReceitaExtraida } from "@/lib/extract/schema";

export const Route = createFileRoute("/ferramenta")({
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
  tpDocumentoDespesa: number;
  tpDocFav: "CPF" | "CNPJ" | "EXT";
  nrDocFav: string;
  descricao: string;
  categoria: string;
  cdModalidadeCompra: number;
  tpDocumentoPagamento: number;
  origem?: "nfe-chave" | "boleto-linha" | "guia-linha" | "favorecido-padrao" | "ia" | null;
  evidencia?: string | null;
};

const STORAGE_KEY = "sit-tcepr-state-v2";
const TERMO_KEY = "sit-tcepr-termo-v1";

const TERMO_DEFAULT: DadosTermo = {
  nrCNPJConcedente: "76206481000158",
  tpTransferencia: 8, // Termo de Colaboração
  nrInternoConcedente: "001",
  anoTransferencia: 2022,
};

function modalidadePadrao(tpDocumento: number): number {
  // Holerite/RPA/Guias/Tarifas → Tributos/Pessoal (100). Resto → Dispensa (8).
  if ([4, 5, 6, 7, 8, 9, 10, 20, 23].includes(tpDocumento)) return 100;
  return 8;
}

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
const simplificarDescricao = (s: string) => {
  let out = cleanText(s ?? "");
  out = out.replace(
    /^(pagamento\s+(referente\s+(a|ao)|de|do)\s+|ref(\.|er[eê]ncia)?\s+(a|ao)\s+|conforme\s+(nota|recibo|nf|cupom)[^,;.]*[,;.]?\s*)/i,
    "",
  );
  out = out.replace(/\s*conforme\s+(nota|nf|recibo|cupom)[^,;.]*$/i, "");
  out = out.replace(/\s+/g, " ").trim();
  return truncate(out, 200);
};
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
    tpDocumentoDespesa: 1,
    cdModalidadeCompra: 8,
    tpDocumentoPagamento: 6,
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

type PdfJobStatus = "pronto" | "enviando" | "analisando" | "mesclando" | "concluido" | "erro";

type PdfJob = {
  id: string;
  file: File;
  status: PdfJobStatus;
  etapa: string | null;
  progresso: number;
  erro: string | null;
};

/**
 * Upload via XHR para ter onprogress real no envio. Para a fase "IA" (caixa-preta),
 * simula uma curva assintótica capada em ~99% até a resposta chegar — rotulado como
 * "estimado" na UI.
 */
function uploadComProgresso(
  file: File,
  onUpload: (pct: number) => void,
  onAnalise: (pct: number) => void,
): Promise<ExtracaoResultado> {
  return new Promise((resolve, reject) => {
    const MAX_BIN = 8 * 1024 * 1024;

    const enviar = (body: XMLHttpRequestBodyInit, headers: Record<string, string> | null, upCb: (p: number) => void, anCb: (p: number) => void): Promise<ExtracaoResultado> => {
      return new Promise((res, rej) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/extract");
        if (headers) {
          for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
        }
        xhr.responseType = "text";
        let analiseTimer: ReturnType<typeof setInterval> | null = null;
        let analiseInicio = 0;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) upCb((e.loaded / e.total) * 100);
        };
        xhr.upload.onload = () => {
          upCb(100);
          analiseInicio = Date.now();
          analiseTimer = setInterval(() => {
            const elapsedS = (Date.now() - analiseInicio) / 1000;
            const pct = Math.min(99, 100 * (1 - Math.exp(-elapsedS / 8)));
            anCb(pct);
          }, 300);
        };
        const cleanup = () => {
          if (analiseTimer) clearInterval(analiseTimer);
        };
        xhr.onerror = () => { cleanup(); rej(new Error("Falha de rede")); };
        xhr.onabort = () => { cleanup(); rej(new Error("Upload cancelado")); };
        xhr.onload = () => {
          cleanup();
          anCb(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              res(JSON.parse(xhr.responseText) as ExtracaoResultado);
            } catch {
              rej(new Error("Resposta inválida do servidor"));
            }
          } else {
            let msg = `Erro ${xhr.status}`;
            try {
              const j = JSON.parse(xhr.responseText) as { error?: string };
              if (j.error) msg = j.error;
            } catch { /* noop */ }
            rej(new Error(msg));
          }
        };
        xhr.send(body);
      });
    };

    (async () => {
      try {
        const { extractPdfText } = await import("@/lib/pdf/extractTextClient");
        onUpload(5);
        const texto = await extractPdfText(file);
        if (texto && texto.length > 500) {
          const res = await enviar(JSON.stringify({ text: texto }), { "Content-Type": "application/json" }, onUpload, onAnalise);
          resolve(res);
          return;
        }

        // Sem texto e arquivo grande -> CHUNKING
        if (file.size > MAX_BIN) {
          try {
            const { PDFDocument } = await import("pdf-lib");
            const arrayBuffer = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(arrayBuffer);
            const totalPages = sourcePdf.getPageCount();
            
            const avgPageBytes = file.size / totalPages;
            const pagesPerChunk = Math.max(1, Math.floor((MAX_BIN * 0.8) / avgPageBytes));
            
            let chunks: File[] = [];
            for (let start = 0; start < totalPages; start += pagesPerChunk) {
               const end = Math.min(start + pagesPerChunk, totalPages);
               const chunkPdf = await PDFDocument.create();
               const copiedPages = await chunkPdf.copyPages(sourcePdf, Array.from({length: end - start}, (_, i) => start + i));
               copiedPages.forEach(p => chunkPdf.addPage(p));
               const chunkBytes = await chunkPdf.save();
               chunks.push(new File([chunkBytes as any], `chunk_${start}_${file.name}`, { type: "application/pdf" }));
            }

            let allDespesas: any[] = [];
            let allReceitas: any[] = [];
            let combinedResumo = { saldoAnterior: 0, transferidos: 0, rendimentos: 0, estornados: 0 };
            let mesReferencia = "";

            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const fd = new FormData();
              fd.append("file", chunk);
              
              const res = await enviar(fd, null, 
                (p) => onUpload((i / chunks.length) * 100 + (p / chunks.length)),
                (p) => onAnalise((i / chunks.length) * 100 + (p / chunks.length))
              );

              if (res.despesas) allDespesas.push(...res.despesas);
              if (res.receitas) allReceitas.push(...res.receitas);
              if (res.resumo) {
                combinedResumo.saldoAnterior += res.resumo.saldoAnterior || 0;
                combinedResumo.transferidos += res.resumo.transferidos || 0;
                combinedResumo.rendimentos += res.resumo.rendimentos || 0;
                combinedResumo.estornados += res.resumo.estornados || 0;
              }
              if (res.mesReferencia && !mesReferencia) mesReferencia = res.mesReferencia;
            }

            resolve({
              despesas: allDespesas,
              receitas: allReceitas,
              resumo: combinedResumo,
              mesReferencia
            });
            return;
          } catch (e) {
             console.warn("Falha no chunking client-side", e);
             reject(new Error(`PDF muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Erro ao dividir o PDF: ${(e as Error).message}`));
             return;
          }
        }

        const fd = new FormData();
        fd.append("file", file);
        const res = await enviar(fd, null, onUpload, onAnalise);
        resolve(res);
      } catch (e) {
        if (file.size > MAX_BIN) {
          reject(new Error(`PDF muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 8 MB. Divida o arquivo ou use um PDF com texto selecionável.`));
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await enviar(fd, null, onUpload, onAnalise);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }
    })();
  });
}

const MAX_LOTE = 10;

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
  const [extracaoOnlineId, setExtracaoOnlineId] = useState<string | null>(null);
  const [hidratado, setHidratado] = useState(false);
  const [salvandoOnline, setSalvandoOnline] = useState(false);
  const [carregarAberto, setCarregarAberto] = useState(false);
  const [listaOnline, setListaOnline] = useState<ExtracaoSalvaResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [termo, setTermo] = useState<DadosTermo>(TERMO_DEFAULT);

  const qc = useQueryClient();
  const fetchComprovantes = useServerFn(listarComprovantes);
  const { data: comprovantes = {} } = useQuery({
    queryKey: ["comprovantes", extracaoOnlineId],
    queryFn: () => fetchComprovantes({ data: { extracaoId: extracaoOnlineId! } }),
    enabled: !!extracaoOnlineId,
  });


  const uploadDoc = useServerFn(anexarComprovante);
  const removeDoc = useServerFn(removerComprovante);
  const viewDoc = useServerFn(linkComprovante);
  const aproveDoc = useServerFn(aprovarComprovante);
  const saveSupplier = useServerFn(salvarFornecedor);
  const findSupplier = useServerFn(buscarPorCnpj);

  const handleSalvarFornecedor = async (d: Despesa) => {
    if (d.tpDocFav !== "CNPJ" || !isValidCNPJ(d.nrDocFav)) {
      toast.error("Informe um CNPJ válido para cadastrar o fornecedor.");
      return;
    }
    if (!d.favorecido.trim()) {
      toast.error("Informe a razão social (favorecido).");
      return;
    }
    try {
      const existing = await findSupplier({ data: { cnpj: d.nrDocFav } });
      if (existing) {
        toast.info(`Fornecedor já cadastrado: ${existing.razao_social}.`);
        return;
      }
      await saveSupplier({
        data: { razao_social: d.favorecido.trim(), cnpj: d.nrDocFav },
      });
      toast.success("Fornecedor cadastrado!");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAnexar = async (uid: string, file: File) => {
    if (!extracaoOnlineId) {
      toast.error("Salve a extração online primeiro para poder anexar documentos.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadDoc({
          data: {
            extracaoId: extracaoOnlineId,
            despesaUid: uid,
            nome: file.name,
            mimeType: file.type,
            conteudoBase64: reader.result as string,
          }
        });
        toast.success("Comprovante anexado!");
        qc.invalidateQueries({ queryKey: ["comprovantes", extracaoOnlineId] });
      } catch (e) {
        toast.error((e as Error).message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoverComprovante = async (id: string) => {
    if (!window.confirm("Remover este comprovante?")) return;
    try {
      await removeDoc({ data: { id } });
      toast.success("Comprovante removido.");
      qc.invalidateQueries({ queryKey: ["comprovantes", extracaoOnlineId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleVerComprovante = async (path: string | null) => {
    if (!path) return;
    try {
      const { url } = await viewDoc({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAprovarComprovante = async (id: string, status: "aprovado" | "rejeitado") => {
    try {
      await aproveDoc({ data: { id, status } });
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["comprovantes", extracaoOnlineId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawT = window.localStorage.getItem(TERMO_KEY);
      if (rawT) {
        const parsed = { ...TERMO_DEFAULT, ...JSON.parse(rawT) } as DadosTermo;
        // Migração: o ano da transferência deve ser o ano de celebração do termo
        // (parte da chave primária no SIT), não o ano do exercício das despesas.
        if (parsed.nrInternoConcedente === "001/2022" && parsed.anoTransferencia === 2026) {
          parsed.anoTransferencia = 2022;
        }
        // Migração: termo 001/2022 de Medianeira é "Termo de Colaboração" (8), não "Convênio" (1).
        if (
          (parsed.nrInternoConcedente === "001/2022" || parsed.nrInternoConcedente === "001") &&
          parsed.nrCNPJConcedente === "76206481000158" &&
          parsed.tpTransferencia === 1
        ) {
          parsed.tpTransferencia = 8;
        }
        // Migração: nrInternoConcedente é só o Número do Instrumento ("001"), o "/2022"
        // do cabeçalho do SIT é apenas a junção visual com o Ano. A chave real é "001".
        if (parsed.nrInternoConcedente === "001/2022") {
          parsed.nrInternoConcedente = "001";
        }
        setTermo(parsed);
      }
    } catch { /* noop */ }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("sit-tcepr-state-v1");
      if (raw) {
        const s = JSON.parse(raw) as {
          mesRef?: string;
          receitas?: ReceitaExtraida[];
          despesas?: (Partial<Despesa> & { tipoDocumento?: number; subtipoDocumento?: number | null })[];
          resumo?: typeof resumo;
          overrides?: Record<string, CategoriaOverride>;
          categoriasExtras?: CategoriaExtra[];
          extracaoOnlineId?: string | null;
        };
        if (s.mesRef) setMesRef(s.mesRef);
        if (s.receitas) setReceitas(s.receitas);
        if (s.despesas) {
          setDespesas(s.despesas.map((d) => {
            const tpDoc = d.tpDocumentoDespesa ?? migrarTipoLegacy(d.tipoDocumento ?? 1, d.subtipoDocumento ?? null);
            return {
              uid: d.uid ?? crypto.randomUUID(),
              idInterno: d.idInterno ?? "",
              data: d.data ?? today(),
              dataEmissao: d.dataEmissao ?? d.data ?? today(),
              favorecido: d.favorecido ?? "",
              documento: d.documento ?? "0",
              valor: Number(d.valor) || 0,
              tpDocumentoDespesa: tpDoc,
              tpDocFav: (d.tpDocFav ?? "CNPJ") as Despesa["tpDocFav"],
              nrDocFav: d.nrDocFav ?? "",
              descricao: d.descricao ?? "",
              categoria: d.categoria ?? CATEGORIAS[0].codigo,
              cdModalidadeCompra: d.cdModalidadeCompra ?? modalidadePadrao(tpDoc),
              tpDocumentoPagamento: d.tpDocumentoPagamento ?? 6,
            };
          }));
        }
        if (s.resumo) setResumo(s.resumo);
        if (s.overrides) setOverrides(s.overrides);
        if (s.categoriasExtras) setCategoriasExtras(s.categoriasExtras);
        if (s.extracaoOnlineId !== undefined) setExtracaoOnlineId(s.extracaoOnlineId);
      }
    } catch { /* noop */ }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(TERMO_KEY, JSON.stringify(termo)); } catch { /* noop */ }
  }, [termo]);

  useEffect(() => {
    if (!hidratado || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mesRef, receitas, despesas, resumo, overrides, categoriasExtras, extracaoOnlineId }),
      );
    } catch {
      /* noop */
    }
  }, [hidratado, mesRef, receitas, despesas, resumo, overrides, categoriasExtras, extracaoOnlineId]);

  function salvarManual() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mesRef, receitas, despesas, resumo, overrides, categoriasExtras, extracaoOnlineId }),
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
    setExtracaoOnlineId(null);
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
      (data.despesas ?? []).map((d) => {
        const tpDoc = migrarTipoLegacy(d.tipoDocumento, d.subtipoDocumento ?? null);
        return {
          uid: crypto.randomUUID(),
          idInterno: d.idInterno,
          data: d.data,
          dataEmissao: d.dataEmissao || d.data,
          favorecido: d.favorecido,
          documento: d.documento || "0",
          valor: Number(d.valor) || 0,
          tpDocumentoDespesa: tpDoc,
          tpDocFav: (d.tpDocFav === "CNPJ" || d.tpDocFav === "EXT" ? d.tpDocFav : "CPF") as Despesa["tpDocFav"],
          nrDocFav: d.nrDocFav,
          descricao: d.descricao,
          categoria: d.sugestaoCategoria || CATEGORIAS[0].codigo,
          cdModalidadeCompra: modalidadePadrao(tpDoc),
          tpDocumentoPagamento: 6,
          origem: (d as { origem?: Despesa["origem"] }).origem ?? "ia",
          evidencia: (d as { evidencia?: string | null }).evidencia ?? null,
        };
      }),
    );
  }

  function mesclarExtracao(data: ExtracaoResultado, isFirst: boolean) {
    if (isFirst) {
      setMesRef(data.mesReferencia ?? "");
      setReceitas(data.receitas ?? []);
      setResumo({
        saldoAnterior: data.resumo?.saldoAnterior ?? 0,
        transferidos: data.resumo?.transferidos ?? 0,
        rendimentos: data.resumo?.rendimentos ?? 0,
        estornados: data.resumo?.estornados ?? 0,
      });
    }
    const novas: Despesa[] = (data.despesas ?? []).map((d) => {
      const tpDoc = migrarTipoLegacy(d.tipoDocumento, d.subtipoDocumento ?? null);
      return {
        uid: crypto.randomUUID(),
        idInterno: d.idInterno,
        data: d.data,
        dataEmissao: d.dataEmissao || d.data,
        favorecido: d.favorecido,
        documento: d.documento || "0",
        valor: Number(d.valor) || 0,
        tpDocumentoDespesa: tpDoc,
        tpDocFav: (d.tpDocFav === "CNPJ" || d.tpDocFav === "EXT" ? d.tpDocFav : "CPF") as Despesa["tpDocFav"],
        nrDocFav: d.nrDocFav,
        descricao: d.descricao,
        categoria: d.sugestaoCategoria || CATEGORIAS[0].codigo,
        cdModalidadeCompra: modalidadePadrao(tpDoc),
        tpDocumentoPagamento: 6,
        origem: (d as { origem?: Despesa["origem"] }).origem ?? "ia",
        evidencia: (d as { evidencia?: string | null }).evidencia ?? null,
      };
    });
    if (isFirst) {
      setDespesas(novas);
    } else {
      setDespesas((prev) => [...prev, ...novas]);
    }
  }

  async function processarLote(
    jobs: PdfJob[],
    regras: RegrasUsuario,
    onUpdate: (id: string, patch: Partial<PdfJob>) => void,
  ): Promise<{ ok: number; fail: number; total: number }> {
    setExtraindo(true);
    let ok = 0;
    let fail = 0;
    let total = 0;
    let contador = 0;
    let isFirst = despesas.length === 0;
    try {
      for (const job of jobs) {
        if (job.status === "concluido") continue;
        onUpdate(job.id, { status: "enviando", etapa: "Enviando PDF…", progresso: 0, erro: null });
        try {
          const data = await uploadComProgresso(job.file, (pct) => {
            onUpdate(job.id, { progresso: Math.min(20, pct * 0.2), etapa: "Enviando PDF…" });
          }, (analisePct) => {
            onUpdate(job.id, { progresso: 20 + analisePct * 0.7, etapa: "IA extraindo (estimado)…", status: "analisando" });
          });
          onUpdate(job.id, { status: "mesclando", etapa: "Aplicando regras…", progresso: 95 });
          const { extracao, proximoContador } = aplicarRegrasUsuario(data, regras, contador);
          contador = proximoContador;
          mesclarExtracao(extracao, isFirst);
          isFirst = false;
          total += extracao.despesas?.length ?? 0;
          ok += 1;
          onUpdate(job.id, { status: "concluido", etapa: `${extracao.despesas?.length ?? 0} despesa(s)`, progresso: 100 });
        } catch (e) {
          fail += 1;
          onUpdate(job.id, { status: "erro", etapa: null, erro: (e as Error).message, progresso: 0 });
        }
      }
      if (ok > 0) toast.success(`${ok} de ${jobs.length} PDFs processados, ${total} despesa(s) adicionadas.`);
      if (fail > 0) toast.error(`${fail} PDF(s) falharam.`);
    } finally {
      setExtraindo(false);
    }
    return { ok, fail, total };
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
        tipoDocumento: d.tpDocumentoDespesa,
        subtipoDocumento: null,
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
      const newId = await salvarExtracaoOnline({
        dados: buildExtracaoAtual(),
        nomeArquivo: mesRef ? `extracao-${mesRef.replace("/", "-")}` : null,
      });
      setExtracaoOnlineId(newId);
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
      setExtracaoOnlineId(id);
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
      if (d.tpDocFav === "CNPJ" && d.nrDocFav.trim() && !isValidCNPJ(d.nrDocFav)) {
        erros.push(`Linha ${i + 1}: CNPJ inválido (${d.nrDocFav}) — ${d.favorecido}.`);
      }
      if (d.tpDocFav === "CPF" && d.nrDocFav.trim() && !isValidCPF(d.nrDocFav)) {
        erros.push(`Linha ${i + 1}: CPF inválido (${d.nrDocFav}) — ${d.favorecido}.`);
      }
      const tpDespesa = CATEGORIA_TO_TPDESPESA[d.categoria] ?? null;
      if (tpDespesa == null) erros.push(`Linha ${i + 1}: categoria ${d.categoria} sem tpDespesa mapeado.`);
      return formatLinhaSIT(termo, {
        tpDespesa,
        tpDocumentoFavorecido: d.tpDocFav,
        nrDocumentoFavorecido: d.nrDocFav,
        nmFavorecido: d.favorecido,
        tpDocumentoDespesa: d.tpDocumentoDespesa,
        nrDocumentoDespesa: d.documento,
        vlDocumentoDespesa: d.valor,
        dtDocumentoDespesa: d.dataEmissao || d.data,
        cdModalidadeCompra: d.cdModalidadeCompra,
        tpDocumentoPagamento: d.tpDocumentoPagamento,
        nrDocumentoPagamento: d.documento,
        dtEmissaoPagamento: d.data,
        dtDebito: d.data,
        dsItemDespesa: d.descricao,
      });
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
      const tipo = TIPOS_DOC_DESPESA.find((t) => t.codigo === d.tpDocumentoDespesa);
      rows.push([
        d.data,
        d.favorecido,
        d.documento,
        tipo ? `${tipo.codigo} — ${tipo.nome}` : String(d.tpDocumentoDespesa),
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
            <Link to="/admin">
              <Button variant="ghost" className="gap-2">
                <Settings2 className="h-4 w-4" /> Admin
              </Button>
            </Link>
            <Link to="/orcamentos">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" /> Orçamentos
              </Button>
            </Link>
            <Button variant="outline" onClick={abrirCarregarOnline} className="gap-2">
              <CloudDownload className="h-4 w-4" /> Carregar online
            </Button>
            <Button variant="outline" onClick={salvarOnline} disabled={!algumDado || salvandoOnline} className="gap-2">
              <Cloud className="h-4 w-4" /> {salvandoOnline ? "Salvando..." : "Salvar online"}
            </Button>
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

      <Dialog open={carregarAberto} onOpenChange={setCarregarAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carregar extração online</DialogTitle>
            <DialogDescription>
              Escolha uma extração salva para hidratar a tabela. Isso substitui o trabalho atual.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {carregandoLista && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!carregandoLista && listaOnline.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma extração salva ainda.</p>
            )}
            {listaOnline.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 rounded border p-2">
                <div className="text-sm">
                  <div className="font-medium">
                    {it.mes_referencia ?? "(sem mês)"} · {it.nome_arquivo ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(it.criada_em).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => carregarItem(it.id)}>Carregar</Button>
                  <Button size="sm" variant="ghost" onClick={() => apagarItem(it.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>


      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <BatchUploadCard onProcess={processarLote} processing={extraindo} />

        <ResumoCards
          resumo={resumo}
          totalExecutado={totalExecutado}
          saldoMes={saldoMes}
          onChange={setResumo}
        />

        <TermoCard termo={termo} onChange={setTermo} />

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
                  comprovantes={comprovantes}
                  onAnexar={handleAnexar}
                  onRemoverComprovante={handleRemoverComprovante}
                  onVerComprovante={handleVerComprovante}
                  onAprovarComprovante={handleAprovarComprovante}
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

function statusLabel(s: PdfJobStatus): string {
  switch (s) {
    case "pronto": return "Pronto";
    case "enviando": return "Enviando";
    case "analisando": return "IA (estimado)";
    case "mesclando": return "Mesclando";
    case "concluido": return "Concluído";
    case "erro": return "Erro";
  }
}

function BatchUploadCard({
  onProcess,
  processing,
}: {
  onProcess: (
    jobs: PdfJob[],
    regras: RegrasUsuario,
    onUpdate: (id: string, patch: Partial<PdfJob>) => void,
  ) => Promise<{ ok: number; fail: number; total: number }>;
  processing: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const [jobs, setJobs] = useState<PdfJob[]>([]);
  const [regras, setRegras] = useState<RegrasUsuario>(REGRAS_DEFAULT);
  const [regrasAberto, setRegrasAberto] = useState(false);
  const [favText, setFavText] = useState("");

  useEffect(() => {
    const r = loadRegras();
    setRegras(r);
    setFavText(favorecidosExtrasToText(r.favorecidosExtras));
  }, []);

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (arr.length === 0) {
      toast.error("Selecione arquivos PDF.");
      return;
    }
    setJobs((prev) => {
      const restante = MAX_LOTE - prev.length;
      if (restante <= 0) {
        toast.error(`Limite de ${MAX_LOTE} PDFs por lote.`);
        return prev;
      }
      const novos = arr.slice(0, restante).map<PdfJob>((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "pronto",
        etapa: null,
        progresso: 0,
        erro: null,
      }));
      if (arr.length > restante) toast.warning(`${arr.length - restante} arquivo(s) ignorado(s) (limite ${MAX_LOTE}).`);
      return [...prev, ...novos];
    });
  }

  function removerJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }
  function limpar() { setJobs([]); }

  function patchJob(id: string, patch: Partial<PdfJob>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function salvarRegras(novas: RegrasUsuario) {
    setRegras(novas);
    saveRegras(novas);
  }

  async function iniciar() {
    const pendentes = jobs.filter((j) => j.status !== "concluido");
    if (pendentes.length === 0) return;
    // sincroniza favorecidos extras a partir do texto
    const fav = parseFavorecidosExtras(favText);
    const regrasFinais = { ...regras, favorecidosExtras: fav };
    salvarRegras(regrasFinais);
    await onProcess(jobs, regrasFinais, patchJob);
  }

  const pendentes = jobs.filter((j) => j.status !== "concluido" && j.status !== "erro").length;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            drag ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
          } ${processing ? "pointer-events-none opacity-60" : ""}`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="font-medium">Arraste PDFs aqui ou clique para selecionar</div>
          <div className="text-sm text-muted-foreground">
            Vários arquivos suportados (até {MAX_LOTE}). A análise só começa quando você clicar em “Iniciar”.
          </div>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            disabled={processing}
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {jobs.length > 0 && (
          <div className="space-y-2">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="truncate text-sm font-medium">{j.file.name}</div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {(j.file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs ${j.status === "erro" ? "text-destructive" : j.status === "concluido" ? "text-green-600" : "text-muted-foreground"}`}>
                      {statusLabel(j.status)}
                    </span>
                    {j.status === "enviando" || j.status === "analisando" || j.status === "mesclando" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : j.status === "concluido" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : j.status === "erro" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={processing}
                        onClick={() => removerJob(j.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {(j.status !== "pronto" || j.progresso > 0) && (
                  <div className="mt-2 space-y-1">
                    <Progress value={j.progresso} />
                    <div className="text-xs text-muted-foreground">
                      {j.erro ? j.erro : j.etapa ?? ""}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border">
          <button
            type="button"
            onClick={() => setRegrasAberto((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/40"
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Regras de extração (opcional)
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${regrasAberto ? "rotate-180" : ""}`} />
          </button>
          {regrasAberto && (
            <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Mês de referência forçado (MM/AAAA)</Label>
                <Input
                  placeholder="ex: 04/2025"
                  value={regras.mesReferenciaForcado}
                  onChange={(e) => setRegras({ ...regras, mesReferenciaForcado: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria padrão (código)</Label>
                <Input
                  placeholder="ex: 3.3.90.30.99"
                  value={regras.categoriaPadrao}
                  onChange={(e) => setRegras({ ...regras, categoriaPadrao: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de documento padrão</Label>
                <Input
                  type="number"
                  min={1}
                  value={regras.tipoDocumentoPadrao}
                  onChange={(e) => setRegras({ ...regras, tipoDocumentoPadrao: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prefixo idInterno</Label>
                <Input
                  value={regras.prefixoIdInterno}
                  onChange={(e) => setRegras({ ...regras, prefixoIdInterno: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">
                  Favorecidos padrão extras — uma por linha: <code>chave =&gt; CNPJ;Nome</code>
                </Label>
                <Textarea
                  rows={3}
                  placeholder={"sanepar => 76484013000145;Companhia de Saneamento do Paraná\ncopel => 76483817000120;Copel Distribuição S.A."}
                  value={favText}
                  onChange={(e) => setFavText(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRegras(REGRAS_DEFAULT);
                    setFavText("");
                    saveRegras(REGRAS_DEFAULT);
                  }}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Restaurar padrão
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {jobs.length === 0
              ? "Nenhum PDF carregado."
              : `${jobs.length} arquivo(s) · ${pendentes} pendente(s)`}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={limpar} disabled={processing || jobs.length === 0}>
              Limpar lista
            </Button>
            <Button onClick={iniciar} disabled={processing || pendentes === 0}>
              <Play className="mr-1 h-4 w-4" />
              {processing ? "Processando…" : `Iniciar análise${pendentes ? ` (${pendentes})` : ""}`}
            </Button>
          </div>
        </div>
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
  comprovantes,
  onAnexar,
  onRemoverComprovante,
  onVerComprovante,
  onAprovarComprovante,
}: {
  despesas: Despesa[];
  onUpdate: (uid: string, patch: Partial<Despesa>) => void;
  onRemove: (uid: string) => void;
  categorias: { codigo: string; nome: string; previsto: number }[];
  comprovantes: Record<string, ComprovanteResumo[]>;
  onAnexar: (uid: string, file: File) => void;
  onRemoverComprovante: (id: string) => void;
  onVerComprovante: (path: string) => void;
  onAprovarComprovante: (id: string, status: "aprovado" | "rejeitado") => void;
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
        const cat = categorias.find((c) => c.codigo === d.categoria);
        const completa =
          d.idInterno.trim() !== "" &&
          d.data.trim() !== "" &&
          d.favorecido.trim() !== "" &&
          d.descricao.trim() !== "" &&
          d.nrDocFav.trim() !== "" &&
          d.documento.trim() !== "" &&
          d.valor > 0 &&
          !!d.tpDocumentoDespesa &&
          d.categoria.trim() !== "";
        return (
          <Card
            key={d.uid}
            className={`border-[1px] ${completa ? "border-emerald-500" : "border-amber-500"} text-black [&_input]:text-black [&_button[role=combobox]]:text-black [&_textarea]:text-black`}
          >
            <CardContent className="p-4 text-black">
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
                  <div className="mb-1 flex items-center gap-2">
                    <Label className="block text-xs text-muted-foreground">Favorecido</Label>
                    {d.origem && d.origem !== "ia" && (
                      <span
                        title={d.evidencia ?? ""}
                        className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
                      >
                        {d.origem === "nfe-chave"
                          ? "📄 chave NF-e"
                          : d.origem === "boleto-linha"
                            ? "🔢 boleto"
                            : d.origem === "guia-linha"
                              ? "🏛️ guia"
                              : "⭐ favorecido padrão"}
                      </span>
                    )}
                    {d.origem === "ia" && (
                      <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        🤖 IA
                      </span>
                    )}
                  </div>
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
                    placeholder="Ex.: Aluguel mar/2025"
                    maxLength={200}
                    onChange={(e) => onUpdate(d.uid, { descricao: e.target.value })}
                    onBlur={(e) => onUpdate(d.uid, { descricao: simplificarDescricao(e.target.value) })}
                    className="h-10 text-sm border-[0.5px] border-black text-foreground"
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
                  <Label className="mb-1 block text-xs text-muted-foreground">Tipo de documento de despesa</Label>
                  <Select
                    value={String(d.tpDocumentoDespesa)}
                    onValueChange={(v) => {
                      const tipo = Number(v);
                      const ov = FAVORECIDO_OVERRIDES[tipo];
                      const patch: Partial<Despesa> = {
                        tpDocumentoDespesa: tipo,
                        cdModalidadeCompra: modalidadePadrao(tipo),
                      };
                      if (ov) {
                        patch.tpDocFav = "CNPJ";
                        patch.nrDocFav = ov.cnpj;
                        patch.favorecido = ov.nome;
                      }
                      onUpdate(d.uid, patch);
                    }}
                  >
                    <SelectTrigger className="h-10 text-sm border-[0.5px] border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {TIPOS_DOC_DESPESA.map((t) => (
                        <SelectItem key={t.codigo} value={String(t.codigo)}>
                          {t.codigo} — {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-1 block text-xs text-muted-foreground">Modalidade de compra</Label>
                  <Select
                    value={String(d.cdModalidadeCompra)}
                    onValueChange={(v) => onUpdate(d.uid, { cdModalidadeCompra: Number(v) })}
                  >
                    <SelectTrigger className="h-10 text-sm border-[0.5px] border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {MODALIDADES_COMPRA.map((m) => (
                        <SelectItem key={m.codigo} value={String(m.codigo)}>
                          {m.codigo} — {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-1 block text-xs text-muted-foreground">Forma de pagamento</Label>
                  <Select
                    value={String(d.tpDocumentoPagamento)}
                    onValueChange={(v) => onUpdate(d.uid, { tpDocumentoPagamento: Number(v) })}
                  >
                    <SelectTrigger className="h-10 text-sm border-[0.5px] border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOC_PAGAMENTO.map((p) => (
                        <SelectItem key={p.codigo} value={String(p.codigo)}>
                          {p.codigo} — {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-1 block text-xs text-muted-foreground">Data emissão doc</Label>
                  <Input
                    type="date"
                    value={d.dataEmissao}
                    onChange={(e) => onUpdate(d.uid, { dataEmissao: e.target.value })}
                    className="h-10 text-sm border-[0.5px] border-black"
                  />
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

                {/* Comprovante UI */}
                <div className="col-span-12 mt-2 pt-3 border-t border-border">
                  <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                    Comprovante
                  </Label>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {(() => {
                      const docs = comprovantes[d.uid] || [];
                      if (docs.length === 0) {
                        return (
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              className="w-[250px] text-xs h-9 cursor-pointer"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onAnexar(d.uid, f);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">Nenhum anexo.</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-col gap-2 w-full">
                          {docs.map((doc) => (
                            <div key={doc.id} className="flex flex-col md:flex-row md:items-center gap-3 bg-muted/30 p-2 rounded border border-border">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm truncate">{doc.nome}</span>
                                {doc.status_aprovacao === "aprovado" && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium shrink-0">Aprovado</span>}
                                {doc.status_aprovacao === "rejeitado" && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium shrink-0">Rejeitado</span>}
                                {doc.status_aprovacao === "pendente" && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium shrink-0">Pendente</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onVerComprovante(doc.arquivo_url!)}>Ver</Button>
                                {!doc.uploaded_by_self && doc.status_aprovacao === "pendente" && (
                                  <>
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => onAprovarComprovante(doc.id, "aprovado")}>Aprovar</Button>
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => onAprovarComprovante(doc.id, "rejeitado")}>Rejeitar</Button>
                                  </>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10" onClick={() => onRemoverComprovante(doc.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
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

function TermoCard({
  termo,
  onChange,
}: {
  termo: DadosTermo;
  onChange: (t: DadosTermo) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados do Termo (constantes do arquivo SIT)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">CNPJ Concedente</Label>
            <Input
              value={termo.nrCNPJConcedente}
              maxLength={14}
              inputMode="numeric"
              onChange={(e) =>
                onChange({ ...termo, nrCNPJConcedente: e.target.value.replace(/\D/g, "").slice(0, 14) })
              }
              className="h-10 text-sm border-[0.5px] border-black"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Tipo de transferência</Label>
            <Select
              value={String(termo.tpTransferencia)}
              onValueChange={(v) => onChange({ ...termo, tpTransferencia: Number(v) })}
            >
              <SelectTrigger className="h-10 text-sm border-[0.5px] border-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TRANSFERENCIA.map((t) => (
                  <SelectItem key={t.codigo} value={String(t.codigo)}>
                    {t.codigo} — {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Nº interno do termo</Label>
            <Input
              value={termo.nrInternoConcedente}
              maxLength={20}
              onChange={(e) =>
                onChange({ ...termo, nrInternoConcedente: e.target.value.slice(0, 20) })
              }
              className="h-10 text-sm border-[0.5px] border-black"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Ano da transferência</Label>
            <Input
              type="number"
              value={termo.anoTransferencia}
              min={2000}
              max={2100}
              onChange={(e) =>
                onChange({ ...termo, anoTransferencia: Number(e.target.value) || new Date().getFullYear() })
              }
              className="h-10 text-sm border-[0.5px] border-black"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
