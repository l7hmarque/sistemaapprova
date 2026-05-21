import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Plus, Trash2, Save, FileDown, FileText, BarChart3, Loader2, FolderOpen, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  gerarOrcamentoNoDrive,
  gerarMapaComparativoNoDrive,
} from "@/lib/orcamentos.functions";

export const Route = createFileRoute("/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — SIT" },
      { name: "description", content: "Geração de orçamentos e mapa comparativo no Drive a partir de modelos." },
    ],
  }),
  component: OrcamentosPage,
});

type Fornecedor = {
  id?: string;
  cnpj: string;
  razao_social: string;
  representante_legal?: string | null;
  cpf_representante?: string | null;
};

type Preset = {
  id: string;
  nome: string;
  objeto: string | null;
  termo: string | null;
  itens: Array<{ descricao: string; qtd: number; unidade: string }>;
  fornecedores_sugeridos: string[];
};

type OrcSalvo = {
  id: string;
  tipo: "cotacao" | "mapa_comparativo";
  objeto: string | null;
  termo: string | null;
  mes_referencia: string | null;
  drive_file_url: string | null;
  criado_em: string;
};

const ENTIDADE_DEFAULT = {
  razao: "Sociedade Civil Nossa Senhora Aparecida",
  cnpj: "01.788.362/0001-51",
  representante: "Raul Oscar Sena Velez",
  cpf: "801.780.489-09",
};

function OrcamentosPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", search: { redirect: "/orcamentos" }, replace: true });
  }, [loading, user, nav]);
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <div className="container mx-auto max-w-6xl px-4 py-6">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orçamentos & Mapa Comparativo</h1>
            <p className="text-sm text-muted-foreground">
              Gera planilhas no Drive a partir dos modelos oficiais e salva o histórico.
            </p>
          </div>
          <Link to="/" className="text-sm text-primary hover:underline">← voltar para extrações</Link>
        </div>

        <Tabs defaultValue="orcamento" className="w-full">
          <TabsList>
            <TabsTrigger value="orcamento"><FileText className="mr-1 h-4 w-4" /> Novo orçamento</TabsTrigger>
            <TabsTrigger value="mapa"><BarChart3 className="mr-1 h-4 w-4" /> Mapa comparativo</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="orcamento" className="mt-4">
            <NovoOrcamento />
          </TabsContent>
          <TabsContent value="mapa" className="mt-4">
            <NovoMapa />
          </TabsContent>
          <TabsContent value="presets" className="mt-4">
            <PresetsTab />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <HistoricoTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* =========================== HOOKS DE DADOS =========================== */

function useFornecedores() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const recarregar = async () => {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("id, cnpj, razao_social, representante_legal, cpf_representante")
      .order("razao_social", { ascending: true });
    if (error) { toast.error("Falha ao listar fornecedores: " + error.message); return; }
    setLista((data ?? []) as Fornecedor[]);
  };
  useEffect(() => { void recarregar(); }, []);
  return { lista, recarregar };
}

function useObjetos() {
  const [lista, setLista] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("objetos_cotacao")
        .select("descricao")
        .order("uso_count", { ascending: false })
        .limit(50);
      setLista((data ?? []).map((r: { descricao: string }) => r.descricao));
    })();
  }, []);
  return lista;
}

async function upsertFornecedor(f: Omit<Fornecedor, "id">): Promise<void> {
  const cnpj = f.cnpj.trim();
  if (!cnpj) return;
  const { data: existing } = await supabase
    .from("fornecedores")
    .select("id")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (existing) return;
  await supabase.from("fornecedores").insert({
    cnpj,
    razao_social: f.razao_social,
    representante_legal: f.representante_legal ?? null,
    cpf_representante: f.cpf_representante ?? null,
  });
}

/* =========================== NOVO ORÇAMENTO (3 fornecedores) =========================== */

type FornInput = {
  razao_social: string;
  cnpj: string;
  representante_legal: string;
  cpf_representante: string;
  validadeDias: number;
};

type ItemOrc3 = {
  descricao: string;
  qtd: number;
  unidade: string;
  precos: [number, number, number];
};

const FORN_VAZIO = (): FornInput => ({
  razao_social: "",
  cnpj: "",
  representante_legal: "",
  cpf_representante: "",
  validadeDias: 30,
});

/* =========================== Rascunhos (localStorage) =========================== */

const RASCUNHO_AUTO_KEY = "orcamentos:rascunho:auto";
const RASCUNHO_NOMEADO_PREFIX = "orcamentos:rascunho:nomeado:";

type RascunhoPayload = {
  entidade?: typeof ENTIDADE_DEFAULT;
  termo?: string;
  forns?: FornInput[];
  objeto?: string;
  data?: string;
  mesRef?: string;
  itens?: ItemOrc3[];
};

function listarRascunhos(): Array<{ nome: string; salvoEm: string }> {
  if (typeof window === "undefined") return [];
  const out: Array<{ nome: string; salvoEm: string }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(RASCUNHO_NOMEADO_PREFIX)) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k) || "{}");
      out.push({ nome: k.slice(RASCUNHO_NOMEADO_PREFIX.length), salvoEm: v.__salvoEm || "" });
    } catch { /* noop */ }
  }
  return out.sort((a, b) => (a.salvoEm < b.salvoEm ? 1 : -1));
}

function salvarRascunhoNomeado(nome: string, payload: RascunhoPayload) {
  try {
    localStorage.setItem(
      RASCUNHO_NOMEADO_PREFIX + nome,
      JSON.stringify({ ...payload, __salvoEm: new Date().toISOString() }),
    );
  } catch { /* noop */ }
}

function lerRascunhoNomeado(nome: string): RascunhoPayload | null {
  try {
    const raw = localStorage.getItem(RASCUNHO_NOMEADO_PREFIX + nome);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function apagarRascunhoNomeado(nome: string) {
  try { localStorage.removeItem(RASCUNHO_NOMEADO_PREFIX + nome); } catch { /* noop */ }
}


function NovoOrcamento() {
  const objetos = useObjetos();
  const { lista: fornecedores, recarregar: recarregarF } = useFornecedores();
  const [entidade, setEntidade] = useState(ENTIDADE_DEFAULT);
  const [termo, setTermo] = useState("001/2022");
  const [forns, setForns] = useState<FornInput[]>([FORN_VAZIO(), FORN_VAZIO(), FORN_VAZIO()]);
  const [objeto, setObjeto] = useState("");
  const [data, setData] = useState(new Date().toLocaleDateString("pt-BR"));
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [itens, setItens] = useState<ItemOrc3[]>([
    { descricao: "", qtd: 1, unidade: "un", precos: [0, 0, 0] },
  ]);
  const [enviando, setEnviando] = useState(false);
  const [gerarMapaJunto, setGerarMapaJunto] = useState(true);
  const [resultados, setResultados] = useState<Array<{ razao: string; url?: string; erro?: string }>>([]);
  const [mapaResult, setMapaResult] = useState<{ url?: string; erro?: string } | null>(null);
  const [rascunhos, setRascunhos] = useState<Array<{ nome: string; salvoEm: string }>>([]);
  const [hidratado, setHidratado] = useState(false);
  const gerar = useServerFn(gerarOrcamentoNoDrive);
  const gerarMapa = useServerFn(gerarMapaComparativoNoDrive);

  // Restaura rascunho automático na montagem
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RASCUNHO_AUTO_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.entidade) setEntidade(s.entidade);
        if (s.termo) setTermo(s.termo);
        if (s.forns) setForns(s.forns);
        if (s.objeto) setObjeto(s.objeto);
        if (s.data) setData(s.data);
        if (s.mesRef) setMesRef(s.mesRef);
        if (s.itens) setItens(s.itens);
      }
    } catch { /* noop */ }
    setRascunhos(listarRascunhos());
    setHidratado(true);
  }, []);

  // Auto-save (debounced)
  useEffect(() => {
    if (!hidratado) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          RASCUNHO_AUTO_KEY,
          JSON.stringify({ entidade, termo, forns, objeto, data, mesRef, itens }),
        );
      } catch { /* noop */ }
    }, 500);
    return () => clearTimeout(t);
  }, [hidratado, entidade, termo, forns, objeto, data, mesRef, itens]);

  const salvarComoRascunho = () => {
    const nome = window.prompt("Nome do rascunho (para reabrir depois):", objeto || "Orçamento em aberto");
    if (!nome?.trim()) return;
    salvarRascunhoNomeado(nome.trim(), { entidade, termo, forns, objeto, data, mesRef, itens });
    setRascunhos(listarRascunhos());
    toast.success(`Rascunho "${nome.trim()}" salvo. Reabra pelo menu abaixo.`);
  };

  const carregarRascunho = (nome: string) => {
    const s = lerRascunhoNomeado(nome);
    if (!s) return toast.error("Rascunho não encontrado.");
    if (s.entidade) setEntidade(s.entidade);
    if (s.termo) setTermo(s.termo);
    if (s.forns) setForns(s.forns);
    if (s.objeto) setObjeto(s.objeto);
    if (s.data) setData(s.data);
    if (s.mesRef) setMesRef(s.mesRef);
    if (s.itens) setItens(s.itens);
    toast.success(`Rascunho "${nome}" carregado.`);
  };

  const apagarRascunho = (nome: string) => {
    apagarRascunhoNomeado(nome);
    setRascunhos(listarRascunhos());
  };


  const updForn = (i: number, patch: Partial<FornInput>) =>
    setForns((x) => x.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  const pickForn = (i: number, cnpj: string) => {
    const f = fornecedores.find((x) => x.cnpj === cnpj);
    if (f) updForn(i, {
      razao_social: f.razao_social,
      cnpj: f.cnpj,
      representante_legal: f.representante_legal || "",
      cpf_representante: f.cpf_representante || "",
    });
  };

  const onAddItem = () => setItens((x) => [...x, { descricao: "", qtd: 1, unidade: "un", precos: [0, 0, 0] }]);
  const onDelItem = (i: number) => setItens((x) => x.filter((_, k) => k !== i));
  const updItem = (i: number, patch: Partial<ItemOrc3>) =>
    setItens((x) => x.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const updPreco = (i: number, col: 0 | 1 | 2, v: number) =>
    setItens((x) => x.map((it, k) => {
      if (k !== i) return it;
      const p = [...it.precos] as [number, number, number];
      p[col] = v;
      return { ...it, precos: p };
    }));

  const totalPorForn = (col: 0 | 1 | 2) =>
    itens.reduce((s, i) => s + (i.qtd || 0) * (i.precos[col] || 0), 0);

  const handleGerar = async () => {
    if (!objeto.trim()) return toast.error("Informe o objeto.");
    const fornsValidos = forns.filter((f) => f.razao_social.trim() && f.cnpj.trim());
    if (fornsValidos.length === 0) return toast.error("Preencha ao menos 1 fornecedor (razão + CNPJ).");
    if (!itens.some((i) => i.descricao.trim())) return toast.error("Adicione ao menos 1 item.");

    setEnviando(true);
    setResultados([]);
    setMapaResult(null);
    const itensValidos = itens.filter((i) => i.descricao.trim());

    const tarefas = forns.map(async (f, idxOriginal) => {
      if (!f.razao_social.trim() || !f.cnpj.trim()) return null;
      try {
        const res = await gerar({
          data: {
            entidade: {
              razao: entidade.razao,
              cnpj: entidade.cnpj,
              representante: entidade.representante,
              cpf: entidade.cpf,
            },
            termo,
            fornecedor: {
              razao: f.razao_social,
              cnpj: f.cnpj,
              representante: f.representante_legal || "",
              cpf: f.cpf_representante || "",
            },
            objeto,
            validadeDias: Number(f.validadeDias) || 30,
            data,
            mesReferencia: mesRef,
            itens: itensValidos.map((i) => ({
              descricao: i.descricao,
              qtd: Number(i.qtd) || 0,
              unidade: i.unidade,
              precoUnitario: Number(i.precos[idxOriginal as 0 | 1 | 2]) || 0,
            })),
          },
        });
        await upsertFornecedor({
          cnpj: f.cnpj,
          razao_social: f.razao_social,
          representante_legal: f.representante_legal,
          cpf_representante: f.cpf_representante,
        });
        return { razao: f.razao_social, url: res.url };
      } catch (e) {
        return { razao: f.razao_social, erro: (e as Error).message };
      }
    });

    const out = (await Promise.all(tarefas)).filter(Boolean) as Array<{ razao: string; url?: string; erro?: string }>;
    setResultados(out);
    const okCount = out.filter((r) => r.url).length;
    const errCount = out.filter((r) => r.erro).length;
    if (okCount > 0) toast.success(`${okCount} orçamento(s) gerado(s).`);
    if (errCount > 0) toast.error(`${errCount} falha(s).`);
    void recarregarF();

    // Mapa comparativo a partir dos mesmos dados
    if (gerarMapaJunto) {
      const fornsM = forns.map((f) => ({
        razao: f.razao_social || "",
        cnpj: f.cnpj || "",
        dataEmissao: data,
        dataValidade: "",
        prazoDias: Number(f.validadeDias) || 0,
      })) as [
        { razao: string; cnpj: string; dataEmissao: string; dataValidade: string; prazoDias: number },
        { razao: string; cnpj: string; dataEmissao: string; dataValidade: string; prazoDias: number },
        { razao: string; cnpj: string; dataEmissao: string; dataValidade: string; prazoDias: number },
      ];
      try {
        const r = await gerarMapa({
          data: {
            entidade: {
              razao: entidade.razao,
              cnpj: entidade.cnpj,
              representante: entidade.representante,
              cpf: entidade.cpf,
            },
            termo,
            objeto,
            mesReferencia: mesRef,
            fornecedores: fornsM,
            itens: itensValidos.map((i) => ({
              descricao: i.descricao,
              unidade: i.unidade,
              qtd: Number(i.qtd) || 0,
              precos: [
                Number(i.precos[0]) || 0,
                Number(i.precos[1]) || 0,
                Number(i.precos[2]) || 0,
              ],
            })),
          },
        });
        setMapaResult({ url: r.url });
        toast.success("Mapa comparativo gerado.");
      } catch (e) {
        setMapaResult({ erro: (e as Error).message });
        toast.error("Falha no mapa: " + (e as Error).message);
      }
    }

    setEnviando(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitação de Cotação (Anexo I) — até 3 fornecedores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Entidade</Label>
            <Input value={entidade.razao} onChange={(e) => setEntidade({ ...entidade, razao: e.target.value })} />
          </div>
          <div>
            <Label>CNPJ entidade</Label>
            <Input value={entidade.cnpj} onChange={(e) => setEntidade({ ...entidade, cnpj: e.target.value })} />
          </div>
          <div>
            <Label>Representante legal</Label>
            <Input value={entidade.representante} onChange={(e) => setEntidade({ ...entidade, representante: e.target.value })} />
          </div>
          <div>
            <Label>CPF representante</Label>
            <Input value={entidade.cpf} onChange={(e) => setEntidade({ ...entidade, cpf: e.target.value })} />
          </div>
          <div>
            <Label>Termo Nº</Label>
            <Input value={termo} onChange={(e) => setTermo(e.target.value)} />
          </div>
          <div>
            <Label>Mês de referência</Label>
            <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Objeto da cotação</Label>
            <Input list="objetos-list" value={objeto} onChange={(e) => setObjeto(e.target.value)} placeholder="ex: Gêneros de alimentação" />
            <datalist id="objetos-list">
              {objetos.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div>
            <Label>Data</Label>
            <Input value={data} onChange={(e) => setData(e.target.value)} placeholder="dd/mm/aaaa" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fornecedores (até 3)</Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {forns.map((f, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="text-xs font-semibold text-muted-foreground">Fornecedor {i + 1}</div>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value=""
                  onChange={(e) => pickForn(i, e.target.value)}
                >
                  <option value="">— salvos —</option>
                  {fornecedores.map((x) => (
                    <option key={x.id} value={x.cnpj}>{x.razao_social}</option>
                  ))}
                </select>
                <div>
                  <Label className="text-xs">Razão social</Label>
                  <Input value={f.razao_social} onChange={(e) => updForn(i, { razao_social: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={f.cnpj} onChange={(e) => updForn(i, { cnpj: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Representante</Label>
                  <Input value={f.representante_legal} onChange={(e) => updForn(i, { representante_legal: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">CPF representante</Label>
                  <Input value={f.cpf_representante} onChange={(e) => updForn(i, { cpf_representante: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Validade (dias)</Label>
                  <Input type="number" min={1} value={f.validadeDias} onChange={(e) => updForn(i, { validadeDias: Number(e.target.value) || 30 })} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Itens ({itens.length}) — preço por fornecedor</Label>
            <Button size="sm" variant="outline" onClick={onAddItem}><Plus className="mr-1 h-3 w-3" /> adicionar item</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Especificação</TableHead>
                <TableHead className="w-16">Qtd</TableHead>
                <TableHead className="w-20">Unid.</TableHead>
                <TableHead className="w-28">P. {forns[0].razao_social || "Forn. 1"}</TableHead>
                <TableHead className="w-28">P. {forns[1].razao_social || "Forn. 2"}</TableHead>
                <TableHead className="w-28">P. {forns[2].razao_social || "Forn. 3"}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell><Textarea rows={2} value={it.descricao} onChange={(e) => updItem(i, { descricao: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" value={it.qtd} onChange={(e) => updItem(i, { qtd: Number(e.target.value) || 0 })} /></TableCell>
                  <TableCell><Input value={it.unidade} onChange={(e) => updItem(i, { unidade: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={it.precos[0]} onChange={(e) => updPreco(i, 0, Number(e.target.value) || 0)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={it.precos[1]} onChange={(e) => updPreco(i, 1, Number(e.target.value) || 0)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={it.precos[2]} onChange={(e) => updPreco(i, 2, Number(e.target.value) || 0)} /></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => onDelItem(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">Total por fornecedor</TableCell>
                <TableCell className="font-semibold">R$ {totalPorForn(0).toFixed(2)}</TableCell>
                <TableCell className="font-semibold">R$ {totalPorForn(1).toFixed(2)}</TableCell>
                <TableCell className="font-semibold">R$ {totalPorForn(2).toFixed(2)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGerar} disabled={enviando}>
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Gerar planilhas no Drive
          </Button>
          <Button type="button" variant="outline" onClick={salvarComoRascunho}>
            <Save className="mr-2 h-4 w-4" />
            Deixar em aberto
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={gerarMapaJunto}
              onChange={(e) => setGerarMapaJunto(e.target.checked)}
            />
            Gerar também o mapa comparativo
          </label>
        </div>

        {rascunhos.length > 0 && (
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <FolderOpen className="h-4 w-4" /> Rascunhos em aberto
            </div>
            <div className="space-y-1">
              {rascunhos.map((r) => (
                <div key={r.nome} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => carregarRascunho(r.nome)}
                    className="truncate text-left text-primary hover:underline"
                  >
                    {r.nome}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {r.salvoEm && <span>{new Date(r.salvoEm).toLocaleString("pt-BR")}</span>}
                    <Button size="icon" variant="ghost" onClick={() => apagarRascunho(r.nome)} title="Apagar rascunho">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Dica: o que você está editando agora também é salvo automaticamente e restaurado se a página recarregar.
            </div>
          </div>
        )}


        {(resultados.length > 0 || mapaResult) && (
          <div className="space-y-1 rounded-md border p-3 text-sm">
            <div className="mb-1 font-semibold">Resultado:</div>
            {resultados.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">Orçamento — {r.razao}</span>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary hover:underline">
                    <ExternalLink className="mr-1 h-3 w-3" /> abrir
                  </a>
                ) : (
                  <span className="text-destructive text-xs">{r.erro}</span>
                )}
              </div>
            ))}
            {mapaResult && (
              <div className="flex items-center justify-between gap-2 border-t pt-1">
                <span className="truncate font-medium">Mapa comparativo</span>
                {mapaResult.url ? (
                  <a href={mapaResult.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary hover:underline">
                    <ExternalLink className="mr-1 h-3 w-3" /> abrir
                  </a>
                ) : (
                  <span className="text-destructive text-xs">{mapaResult.erro}</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================== NOVO MAPA =========================== */

type ItemMapa = { descricao: string; unidade: string; qtd: number; precos: [number, number, number] };

function NovoMapa() {
  const objetos = useObjetos();
  const { lista: fornecedores } = useFornecedores();
  const [entidade, setEntidade] = useState(ENTIDADE_DEFAULT);
  const [termo, setTermo] = useState("001/2022");
  const [objeto, setObjeto] = useState("");
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [forns, setForns] = useState<Array<{ razao: string; cnpj: string; dataEmissao: string; dataValidade: string; prazoDias: number }>>([
    { razao: "", cnpj: "", dataEmissao: "", dataValidade: "", prazoDias: 0 },
    { razao: "", cnpj: "", dataEmissao: "", dataValidade: "", prazoDias: 0 },
    { razao: "", cnpj: "", dataEmissao: "", dataValidade: "", prazoDias: 0 },
  ]);
  const [itens, setItens] = useState<ItemMapa[]>([{ descricao: "", unidade: "un", qtd: 1, precos: [0, 0, 0] }]);
  const [enviando, setEnviando] = useState(false);
  const [ultimoLink, setUltimoLink] = useState<string | null>(null);
  const gerar = useServerFn(gerarMapaComparativoNoDrive);

  const updForn = (i: number, patch: Partial<typeof forns[number]>) =>
    setForns((x) => x.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const pickForn = (i: number, cnpj: string) => {
    const f = fornecedores.find((x) => x.cnpj === cnpj);
    if (f) updForn(i, { razao: f.razao_social, cnpj: f.cnpj });
  };

  const onAddItem = () => setItens((x) => [...x, { descricao: "", unidade: "un", qtd: 1, precos: [0, 0, 0] }]);
  const onDelItem = (i: number) => setItens((x) => x.filter((_, k) => k !== i));
  const updItem = (i: number, patch: Partial<ItemMapa>) => setItens((x) => x.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const updPreco = (i: number, col: 0 | 1 | 2, v: number) =>
    setItens((x) => x.map((it, k) => {
      if (k !== i) return it;
      const p = [...it.precos] as [number, number, number];
      p[col] = v;
      return { ...it, precos: p };
    }));

  const handleGerar = async () => {
    if (!objeto.trim()) return toast.error("Informe o objeto.");
    if (forns.some((f) => !f.razao.trim())) return toast.error("Preencha os 3 fornecedores.");
    if (!itens.some((i) => i.descricao.trim())) return toast.error("Adicione ao menos 1 item.");

    setEnviando(true);
    setUltimoLink(null);
    try {
      const res = await gerar({
        data: {
          entidade: {
            razao: entidade.razao,
            cnpj: entidade.cnpj,
            representante: entidade.representante,
            cpf: entidade.cpf,
          },
          termo,
          objeto,
          mesReferencia: mesRef,
          fornecedores: [
            { ...forns[0], prazoDias: Number(forns[0].prazoDias) || 0 },
            { ...forns[1], prazoDias: Number(forns[1].prazoDias) || 0 },
            { ...forns[2], prazoDias: Number(forns[2].prazoDias) || 0 },
          ],
          itens: itens
            .filter((i) => i.descricao.trim())
            .map((i) => ({
              descricao: i.descricao,
              unidade: i.unidade,
              qtd: Number(i.qtd) || 0,
              precos: [
                Number(i.precos[0]) || 0,
                Number(i.precos[1]) || 0,
                Number(i.precos[2]) || 0,
              ] as [number, number, number],
            })),
        },
      });
      setUltimoLink(res.url);
      toast.success("Mapa comparativo gerado no Drive.");
      // Auto-salva fornecedores
      for (const f of forns) {
        if (f.cnpj && f.razao) await upsertFornecedor({ cnpj: f.cnpj, razao_social: f.razao });
      }
    } catch (e) {
      toast.error("Falha: " + (e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Mapa Comparativo (Anexo II)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Entidade</Label>
            <Input value={entidade.razao} onChange={(e) => setEntidade({ ...entidade, razao: e.target.value })} />
          </div>
          <div>
            <Label>CNPJ entidade</Label>
            <Input value={entidade.cnpj} onChange={(e) => setEntidade({ ...entidade, cnpj: e.target.value })} />
          </div>
          <div>
            <Label>Representante legal</Label>
            <Input value={entidade.representante} onChange={(e) => setEntidade({ ...entidade, representante: e.target.value })} />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={entidade.cpf} onChange={(e) => setEntidade({ ...entidade, cpf: e.target.value })} />
          </div>
          <div>
            <Label>Termo</Label>
            <Input value={termo} onChange={(e) => setTermo(e.target.value)} />
          </div>
          <div>
            <Label>Mês de referência</Label>
            <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Objeto da cotação</Label>
            <Input list="objetos-list-mapa" value={objeto} onChange={(e) => setObjeto(e.target.value)} />
            <datalist id="objetos-list-mapa">
              {objetos.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fornecedores (3)</Label>
          {forns.map((f, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label className="text-xs">Razão social</Label>
                <Input value={f.razao} onChange={(e) => updForn(i, { razao: e.target.value })} />
                <select
                  className="mt-1 h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value=""
                  onChange={(e) => pickForn(i, e.target.value)}
                >
                  <option value="">salvos…</option>
                  {fornecedores.map((x) => <option key={x.id} value={x.cnpj}>{x.razao_social}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">CNPJ</Label>
                <Input value={f.cnpj} onChange={(e) => updForn(i, { cnpj: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Data emissão</Label>
                <Input value={f.dataEmissao} onChange={(e) => updForn(i, { dataEmissao: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
              <div>
                <Label className="text-xs">Validade</Label>
                <Input value={f.dataValidade} onChange={(e) => updForn(i, { dataValidade: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
              <div>
                <Label className="text-xs">Prazo (dias)</Label>
                <Input type="number" value={f.prazoDias} onChange={(e) => updForn(i, { prazoDias: Number(e.target.value) || 0 })} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Itens ({itens.length})</Label>
            <Button size="sm" variant="outline" onClick={onAddItem}><Plus className="mr-1 h-3 w-3" /> adicionar item</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Especificação</TableHead>
                <TableHead className="w-20">Unidade</TableHead>
                <TableHead className="w-16">Qtd</TableHead>
                <TableHead className="w-24">P. {forns[0].razao || "Forn. 1"}</TableHead>
                <TableHead className="w-24">P. {forns[1].razao || "Forn. 2"}</TableHead>
                <TableHead className="w-24">P. {forns[2].razao || "Forn. 3"}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell><Textarea rows={2} value={it.descricao} onChange={(e) => updItem(i, { descricao: e.target.value })} /></TableCell>
                  <TableCell><Input value={it.unidade} onChange={(e) => updItem(i, { unidade: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" value={it.qtd} onChange={(e) => updItem(i, { qtd: Number(e.target.value) || 0 })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={it.precos[0]} onChange={(e) => updPreco(i, 0, Number(e.target.value) || 0)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={it.precos[1]} onChange={(e) => updPreco(i, 1, Number(e.target.value) || 0)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={it.precos[2]} onChange={(e) => updPreco(i, 2, Number(e.target.value) || 0)} /></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => onDelItem(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleGerar} disabled={enviando}>
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Gerar mapa no Drive
          </Button>
          {ultimoLink && (
            <a href={ultimoLink} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-primary hover:underline">
              <ExternalLink className="mr-1 h-3 w-3" /> abrir no Sheets
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================== PRESETS =========================== */

function PresetsTab() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [nome, setNome] = useState("");
  const [objeto, setObjeto] = useState("");
  const [termo, setTermo] = useState("001/2022");
  const [itensTxt, setItensTxt] = useState("Carne bovina; kg; 10\nArroz tipo 1; kg; 20");

  const recarregar = async () => {
    const { data } = await supabase
      .from("orcamento_presets")
      .select("id, nome, objeto, termo, itens, fornecedores_sugeridos")
      .order("criado_em", { ascending: false });
    setPresets((data ?? []) as Preset[]);
  };
  useEffect(() => { void recarregar(); }, []);

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Dê um nome ao preset.");
    const itens = itensTxt
      .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .map((l) => {
        const [desc, un = "un", qtd = "1"] = l.split(";").map((s) => s.trim());
        return { descricao: desc, unidade: un, qtd: Number(qtd) || 1 };
      });
    const { error } = await supabase.from("orcamento_presets").insert({
      nome, objeto, termo, itens, fornecedores_sugeridos: [],
    });
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Preset salvo.");
    setNome("");
    await recarregar();
  };

  const apagar = async (id: string) => {
    await supabase.from("orcamento_presets").delete().eq("id", id);
    await recarregar();
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Novo preset</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Cesta básica mensal" /></div>
          <div><Label>Objeto</Label><Input value={objeto} onChange={(e) => setObjeto(e.target.value)} /></div>
          <div><Label>Termo</Label><Input value={termo} onChange={(e) => setTermo(e.target.value)} /></div>
          <div>
            <Label>Itens (uma linha = descrição; unidade; qtd)</Label>
            <Textarea rows={8} value={itensTxt} onChange={(e) => setItensTxt(e.target.value)} />
          </div>
          <Button onClick={salvar}><Save className="mr-2 h-4 w-4" />Salvar preset</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Presets salvos ({presets.length})</CardTitle></CardHeader>
        <CardContent>
          {presets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum preset ainda.</p>}
          <ul className="space-y-2">
            {presets.map((p) => (
              <li key={p.id} className="flex items-start justify-between rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.objeto} · {p.itens?.length ?? 0} itens</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => apagar(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================== HISTÓRICO =========================== */

function HistoricoTab() {
  const [lista, setLista] = useState<OrcSalvo[]>([]);
  const recarregar = async () => {
    const { data } = await supabase
      .from("orcamentos_salvos")
      .select("id, tipo, objeto, termo, mes_referencia, drive_file_url, criado_em")
      .order("criado_em", { ascending: false })
      .limit(100);
    setLista((data ?? []) as OrcSalvo[]);
  };
  useEffect(() => { void recarregar(); }, []);

  const apagar = async (id: string) => {
    await supabase.from("orcamentos_salvos").delete().eq("id", id);
    await recarregar();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Orçamentos salvos ({lista.length})</CardTitle></CardHeader>
      <CardContent>
        {lista.length === 0 && <p className="text-sm text-muted-foreground">Nada salvo ainda.</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Objeto</TableHead>
              <TableHead>Mês ref.</TableHead>
              <TableHead>Drive</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-xs">{new Date(o.criado_em).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{o.tipo === "cotacao" ? "Orçamento" : "Mapa"}</TableCell>
                <TableCell className="text-xs">{o.objeto}</TableCell>
                <TableCell className="text-xs">{o.mes_referencia}</TableCell>
                <TableCell>
                  {o.drive_file_url && (
                    <a href={o.drive_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
                      <ExternalLink className="mr-1 h-3 w-3" /> abrir
                    </a>
                  )}
                </TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => apagar(o.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
