/**
 * Executa o pipeline de captura de um documento em segundo plano,
 * a partir de um `captura_jobs.id`. Roda no Worker com service role,
 * então NUNCA importe este arquivo do lado do cliente.
 *
 * Etapas:
 *  1. Marca o job como `processando` (idempotente — se já não estiver `pendente` sai).
 *  2. Baixa o arquivo do bucket `documentos`.
 *  3. Extrai texto (unpdf) quando aplicável.
 *  4. Chama a IA (extraDadosViaIA) reaproveitando o mesmo prompt do server fn `extrairDocumento`.
 *  5. Cria/atualiza fornecedor, lança evento financeiro e o anexo, e tenta vínculo automático.
 *  6. Grava resultado no job (`concluido` | `erro`).
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extrairTextoPorPagina } from "@/lib/extract/pdfText";
import { resolverCamposSIT } from "@/lib/sit/inferCaptura";
import { aplicarRegrasDespesa, type RegraDespesa } from "@/lib/sit/regrasDespesa";

type Dados = {
  tipo: string | null;
  cnpj: string | null;
  razao_social: string | null;
  valor: number | null;
  numero: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string | null;
  forma_pagamento: string | null;
  numero_pagamento: string | null;
};

const SYSTEM = `Você extrai dados de documentos financeiros brasileiros (boleto, NF/NFS-e, fatura, holerite, comprovante de pagamento, guia DARF/GPS/GFIP, cupom fiscal).

O PDF/imagem PODE conter MÚLTIPLOS documentos DISTINTOS (ex.: vários holerites de funcionários diferentes, várias NFs, vários boletos). Nesses casos, retorne UM ITEM POR DESPESA.

REGRA IMPORTANTE de consolidação: quando o mesmo documento vem acompanhado do respectivo comprovante de pagamento (boleto + comprovante do mesmo valor/beneficiário; NF + comprovante), CONSOLIDE em um único item — preencha o comprovante em data_pagamento/forma_pagamento/numero_pagamento. Só separe quando forem despesas realmente distintas (CNPJs, favorecidos, valores ou finalidades diferentes).

Retorne SOMENTE JSON válido, sem markdown, no formato:
{
  "documentos": [
    {
      "tipo": "boleto"|"nf"|"fatura"|"holerite"|"comprovante_pgto"|"guia"|"darf"|"gps"|"gfip"|"grrf"|"gfd"|"cupom"|"recibo"|"outro",
      "cnpj": "00000000000000"|null,
      "razao_social": "string"|null,
      "valor": número|null,
      "numero": "string"|null,
      "data_emissao": "AAAA-MM-DD"|null,
      "data_vencimento": "AAAA-MM-DD"|null,
      "data_pagamento": "AAAA-MM-DD"|null,
      "descricao": "resumo curto (máx 200 caracteres, inclua nome do funcionário se holerite)",
      "forma_pagamento": "pix"|"ted"|"doc"|"cheque"|"ordem bancaria"|"debito em conta"|"deposito"|null,
      "numero_pagamento": "string"|null,
      "paginas": [1, 2]
    }
  ]
}
Regras: cnpj só dígitos; valor como número (nunca soma de vários documentos); se não tiver certeza use null; NÃO invente; se houver apenas um documento no arquivo, retorne uma lista com um único item.`;


function sanitize(text: string): string {
  let s = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b > a) s = s.slice(a, b + 1);
  return s;
}
function parseData(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function parseUmDado(p: Record<string, unknown>): Dados {
  const valor =
    typeof p.valor === "number" ? p.valor
    : typeof p.valor === "string" ? Number(String(p.valor).replace(/\./g, "").replace(",", ".")) : null;
  const cnpj = typeof p.cnpj === "string" ? p.cnpj.replace(/\D/g, "") : null;
  const razao = typeof p.razao_social === "string" ? p.razao_social.trim() : null;
  const descricao = typeof p.descricao === "string" ? p.descricao.trim().slice(0, 200) : null;
  return {
    tipo: typeof p.tipo === "string" ? p.tipo : null,
    cnpj: cnpj && cnpj.length >= 11 ? cnpj : null,
    razao_social: razao && razao.length > 0 ? razao : null,
    valor: typeof valor === "number" && Number.isFinite(valor) ? valor : null,
    numero: typeof p.numero === "string" ? p.numero : null,
    data_emissao: parseData(p.data_emissao),
    data_vencimento: parseData(p.data_vencimento),
    data_pagamento: parseData(p.data_pagamento),
    descricao,
    forma_pagamento: typeof p.forma_pagamento === "string" ? p.forma_pagamento : null,
    numero_pagamento: typeof p.numero_pagamento === "string" ? p.numero_pagamento : null,
  };
}
function parseListaDados(raw: string): Dados[] {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(sanitize(raw)); } catch { /* noop */ }
  const lista = Array.isArray((p as { documentos?: unknown }).documentos)
    ? ((p as { documentos: unknown[] }).documentos)
    : Array.isArray(p) ? (p as unknown[])
    : [p];
  return lista
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => parseUmDado(x));
}
function pareceVazio(d: Dados): boolean {
  return (d.tipo === null || d.tipo === "outro") && d.valor === null && d.cnpj === null;
}
function inferirCategoria(d?: Dados | null): string {
  const t = `${d?.tipo ?? ""} ${d?.descricao ?? ""}`.toLowerCase();
  if (/holerite|sal[áa]rio|folha|rescis[ãa]o|rpa/.test(t)) return "salario";
  if (/energia|copel|eletric/.test(t)) return "energia";
  if (/[áa]gua|sanepar|saae/.test(t)) return "agua";
  if (/internet|telef|vivo|claro|tim|oi\b/.test(t)) return "internet";
  if (/aluguel|loca[çc][ãa]o/.test(t)) return "aluguel";
  if (/darf|gps|gfip|inss|fgts|iss|tribut|guia/.test(t)) return "tributos";
  if (/manuten[çc][ãa]o|reparo|conserto/.test(t)) return "manutencao";
  if (/servi[çc]o|nf|nfs|nota\s*fiscal/.test(t)) return "servico";
  if (/boleto|fatura|cupom|compra/.test(t)) return "compra_eventual";
  return "outros";
}

function msgErro(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const t = String(raw).toLowerCase();
  if (!t) return "Falha desconhecida. Reprocesse em alguns instantes.";
  if (t.includes("timeout") || t.includes("timed out")) return "Tempo esgotado. Reprocesse.";
  if (t.includes("network") || t.includes("fetch")) return "Sem resposta da rede. Reprocesse.";
  if (t.includes("permission") || t.includes("rls")) return "Sem permissão para concluir a operação.";
  if (t.includes("storage") || t.includes("not found")) return "Arquivo não encontrado no armazenamento.";
  if (t.includes("too large") || t.includes("413")) return "Arquivo muito grande.";
  if (raw.length > 160) return "Falha ao processar o documento.";
  return raw;
}

async function chamarIA(args: {
  apiKey: string;
  modelo: string;
  texto?: string;
  bytes?: Uint8Array;
  mimeType: string;
  nomeArquivo: string;
}): Promise<Dados[]> {
  const gateway = createLovableAiGatewayProvider(args.apiKey);
  const model = gateway(args.modelo);
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string }
    | { type: "image"; image: string }
  > = [{ type: "text", text: `Arquivo: ${args.nomeArquivo}\nExtraia os campos e responda SOMENTE com o JSON.` }];
  if (args.bytes) {
    if (args.mimeType.startsWith("image/")) {
      // Convert to base64 data URL for image input
      let bin = "";
      for (const b of args.bytes) bin += String.fromCharCode(b);
      const b64 = btoa(bin);
      parts.push({ type: "image", image: `data:${args.mimeType};base64,${b64}` });
    } else {
      parts.push({ type: "file", data: args.bytes, mediaType: args.mimeType || "application/pdf" });
    }
  } else if (args.texto) {
    parts.push({ type: "text", text: `Texto extraído do documento:\n${args.texto.slice(0, 60_000)}` });
  }
  const { text } = await generateText({ model, system: SYSTEM, messages: [{ role: "user", content: parts }] });
  return parseListaDados(text);
}


async function marcarErro(jobId: string, mensagem: string) {
  await supabaseAdmin
    .from("captura_jobs")
    .update({ status: "erro", mensagem, finalizado_em: new Date().toISOString() })
    .eq("id", jobId);
}

/** Reivindica o job em `pendente` → `processando`. Retorna false se já foi tomado. */
async function reivindicar(jobId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("captura_jobs")
    .update({
      status: "processando",
      iniciado_em: new Date().toISOString(),
      mensagem: "processando",
    })
    .eq("id", jobId)
    .in("status", ["pendente"])
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("[captura-worker] falha ao reivindicar", error.message);
    return false;
  }
  return !!data;
}

export async function processarCapturaJob(jobId: string): Promise<void> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await marcarErro(jobId, "LOVABLE_API_KEY ausente no servidor.");
    return;
  }

  // 1. Reivindica o job
  const ok = await reivindicar(jobId);
  if (!ok) {
    console.info(`[captura-worker] job ${jobId} já reivindicado ou não está pendente`);
    return;
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("captura_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobErr || !job) {
    console.error("[captura-worker] job não encontrado", jobId, jobErr);
    return;
  }

  const orgId = job.organization_id;
  const mesRef: string = job.mes_referencia;
  const nomeArquivo: string = job.nome_arquivo;
  const mime: string = job.mime_type || "application/octet-stream";
  const path: string = job.storage_path;
  const hash: string = job.arquivo_hash;

  try {
    // 2. Baixa do Storage
    const dl = await supabaseAdmin.storage.from("documentos").download(path);
    if (dl.error || !dl.data) throw new Error(dl.error?.message || "Falha ao baixar do Storage");
    const bytes = new Uint8Array(await dl.data.arrayBuffer());

    // Cria signed URL (7 dias) para o anexo
    const { data: signed } = await supabaseAdmin
      .storage.from("documentos").createSignedUrl(path, 60 * 60 * 24 * 7);

    // 3. Dedup
    const { data: existentes } = await supabaseAdmin
      .from("documentos_anexos")
      .select("id")
      .eq("arquivo_hash", hash)
      .eq("organization_id", orgId)
      .limit(1);
    const ehDuplicata = !!(existentes && existentes.length);

    // 4. Texto (só para PDF)
    const ehPdf = mime === "application/pdf" || nomeArquivo.toLowerCase().endsWith(".pdf");
    const ehImagem = mime.startsWith("image/");
    let texto = "";
    if (ehPdf) {
      try {
        const paginas = await Promise.race([
          extrairTextoPorPagina(bytes),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("pdf-text timeout")), 15_000)),
        ]);
        texto = paginas.map((p) => p.texto).join("\n\n");
      } catch (e) {
        console.warn("[captura-worker] extração de texto falhou, seguindo com bytes", e);
      }
    }
    const letras = (texto.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    const digitos = (texto.match(/\d/g) || []).length;
    const temTextoUtil = texto.trim().length > 80 && letras > 40 && digitos > 4;

    // 5. IA — extrai LISTA de documentos
    await supabaseAdmin.from("captura_jobs").update({ mensagem: "lendo documento" }).eq("id", jobId);

    const dadosVazio: Dados = {
      tipo: null, cnpj: null, razao_social: null, valor: null, numero: null,
      data_emissao: null, data_vencimento: null, data_pagamento: null,
      descricao: nomeArquivo, forma_pagamento: null, numero_pagamento: null,
    };
    let listaDados: Dados[] = [];
    try {
      const ehVisual = ehPdf || ehImagem;
      const modeloPrincipal = ehVisual ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-lite";
      const primeiro = await chamarIA({
        apiKey,
        modelo: modeloPrincipal,
        texto: temTextoUtil ? texto : undefined,
        bytes: (ehPdf && !temTextoUtil) || ehImagem ? bytes : undefined,
        mimeType: mime,
        nomeArquivo,
      });
      listaDados = primeiro;
      const todosVazios = listaDados.length === 0 || listaDados.every(pareceVazio);
      if (todosVazios && (ehVisual || temTextoUtil)) {
        try {
          const segundo = await chamarIA({
            apiKey,
            modelo: "google/gemini-2.5-pro",
            texto: temTextoUtil ? texto : undefined,
            bytes: (ehPdf && !temTextoUtil) || ehImagem ? bytes : undefined,
            mimeType: mime,
            nomeArquivo,
          });
          if (segundo.length && segundo.some((d) => !pareceVazio(d))) listaDados = segundo;
        } catch (e) {
          console.warn("[captura-worker] fallback Pro falhou", e);
        }
      }
    } catch (e) {
      console.warn("[captura-worker] IA falhou, seguindo com dados vazios", e);
    }
    if (listaDados.length === 0) listaDados = [dadosVazio];

    // 6. Vínculo / fornecedor / evento — carrega config e caches uma vez
    await supabaseAdmin.from("captura_jobs").update({ mensagem: "lançando eventos" }).eq("id", jobId);

    const [{ data: cfg }, { data: fornsRaw }, { data: eventos }, { data: regrasRaw }, { data: natRaw }] = await Promise.all([
      supabaseAdmin.from("configuracoes").select("valor").eq("organization_id", orgId).eq("chave", "auto_vinculo").maybeSingle(),
      supabaseAdmin.from("fornecedores").select("id, razao_social, cnpj, regras_sit").eq("organization_id", orgId),
      supabaseAdmin
        .from("eventos_financeiros")
        .select("id, valor_previsto, data_vencimento, fornecedor_id")
        .eq("organization_id", orgId)
        .eq("mes_referencia", mesRef)
        .is("excluido_em", null),
      supabaseAdmin.from("regras_despesa").select("*").eq("organization_id", orgId),
      supabaseAdmin.from("naturezas_despesa").select("codigo").eq("ativo", true),
    ]);
    const regrasOrg = (regrasRaw ?? []) as Array<RegraDespesa & { set_natureza_codigo?: string | null }>;
    const naturezasAtivas = new Set<string>((natRaw ?? []).map((n) => n.codigo as string));
    const v = cfg?.valor as { valor_centavos?: number; janela_dias?: number } | undefined;
    const tolValor = ((typeof v?.valor_centavos === "number" ? v.valor_centavos : 50)) / 100;
    const tolMs = ((typeof v?.janela_dias === "number" ? v.janela_dias : 3)) * 86_400_000;

    type Forn = { id: string; razao_social: string; cnpj: string; regras_sit?: unknown };
    const fornCache = new Map<string, Forn>();
    (fornsRaw ?? []).forEach((f) => {
      const key = f.cnpj.replace(/\D/g, "");
      if (key) fornCache.set(key, f as unknown as Forn);
    });
    const eventosVinculados = new Set<string>();

    let ultimoEventoId: string | null = null;
    let ultimoAnexoId: string | null = null;
    let contadorCriados = 0;
    let contadorVinculados = 0;

    // Processa cada documento individualmente
    for (let idx = 0; idx < listaDados.length; idx++) {
      const dados = listaDados[idx];
      const primeiroDoLote = idx === 0;
      const cnpjDigits = dados.cnpj ? String(dados.cnpj).replace(/\D/g, "") : null;

      let fornEncontrado: Forn | null = null;
      if (cnpjDigits && fornCache.has(cnpjDigits)) {
        fornEncontrado = fornCache.get(cnpjDigits) ?? null;
      }
      if (!fornEncontrado && cnpjDigits && dados.razao_social) {
        const fIns = await supabaseAdmin
          .from("fornecedores")
          .insert({ organization_id: orgId, cnpj: cnpjDigits, razao_social: dados.razao_social })
          .select("id, razao_social, cnpj, regras_sit")
          .single();
        if (fIns.data) {
          fornEncontrado = fIns.data as unknown as Forn;
        } else if (fIns.error) {
          const { data: ja } = await supabaseAdmin
            .from("fornecedores")
            .select("id, razao_social, cnpj, regras_sit")
            .eq("organization_id", orgId)
            .eq("cnpj", cnpjDigits)
            .maybeSingle();
          if (ja) fornEncontrado = ja as unknown as Forn;
        }
        if (fornEncontrado) fornCache.set(cnpjDigits, fornEncontrado);
      }

      // Tenta vincular a evento existente
      let eventoId: string | null = null;
      const valorNum = dados.valor != null && Number.isFinite(Number(dados.valor)) && Number(dados.valor) > 0
        ? Number(dados.valor) : null;
      if (fornEncontrado && valorNum != null && eventos) {
        const dataDoc = dados.data_vencimento ?? dados.data_emissao ?? dados.data_pagamento ?? null;
        const cand = eventos.filter((e) => {
          if (eventosVinculados.has(e.id)) return false;
          if (e.fornecedor_id !== fornEncontrado!.id) return false;
          if (e.valor_previsto == null) return false;
          if (Math.abs(Number(e.valor_previsto) - valorNum) > tolValor) return false;
          if (dataDoc && e.data_vencimento) {
            const d1 = new Date(dataDoc).getTime();
            const d2 = new Date(e.data_vencimento).getTime();
            if (Math.abs(d1 - d2) > tolMs) return false;
          }
          return true;
        });
        if (cand.length === 1) {
          eventoId = cand[0].id;
          eventosVinculados.add(eventoId);
        }
      }

      // Só o primeiro item do lote pode ser marcado como duplicata (do arquivo inteiro)
      const marcarDuplicata = primeiroDoLote && ehDuplicata;

      let eventoCriado = false;
      if (!eventoId) {
        const categoria = inferirCategoria(dados);
        const descricaoRaw = (dados.descricao && dados.descricao.trim()) || (dados.tipo ?? nomeArquivo);
        const descricaoBase = descricaoRaw.slice(0, 200);
        const descricao = marcarDuplicata ? `[DUPLICATA] ${descricaoBase}`.slice(0, 220) : descricaoBase;
        const dataVenc = dados.data_vencimento ?? dados.data_emissao ?? null;
        const dataPag = dados.data_pagamento ?? null;
        const temPagamento = !!dataPag;
        const cnpjForFav = fornEncontrado?.cnpj?.replace(/\D/g, "") ?? cnpjDigits;
        const camposSIT = resolverCamposSIT({
          regras_sit: (fornEncontrado?.regras_sit as Record<string, unknown> | null | undefined) ?? null,
          tipo: dados.tipo ?? null,
          descricao: dados.descricao ?? null,
          forma_pagamento: dados.forma_pagamento ?? null,
          cnpj_favorecido: cnpjForFav,
          nm_favorecido: fornEncontrado?.razao_social ?? dados.razao_social ?? null,
          razao_social_ia: dados.razao_social ?? null,
        });

        // Aplica regras da organização + defaults determinísticos.
        const { evento: camposFinal } = aplicarRegrasDespesa(
          {
            tp_despesa: camposSIT.tp_despesa,
            tp_documento_despesa: camposSIT.tp_documento_despesa,
            cd_modalidade_compra: camposSIT.cd_modalidade_compra,
            tp_documento_pagamento: camposSIT.tp_documento_pagamento,
            tp_doc_fav: camposSIT.tp_doc_fav,
            nr_doc_fav: camposSIT.nr_doc_fav,
            nm_favorecido: camposSIT.nm_favorecido,
          },
          regrasOrg,
        );
        // Default: REO 271 (3.3.90.39.99) → Pesquisa de Preços quando ainda vazio.
        if (camposFinal.tp_despesa === 271 && camposFinal.cd_modalidade_compra == null) {
          camposFinal.cd_modalidade_compra = 101;
        }
        // Nº doc pagamento espelha Nº do documento quando não vier valor específico.
        const nrDocPagamento = dados.numero_pagamento ?? dados.numero ?? null;

        // Resolve natureza contábil: sugestão da extração → regra por fornecedor → null
        let naturezaResolvida: string | null = null;
        let origemNatureza: "ia" | "regra_fornecedor" | null = null;
        const sugestao = (dados as { sugestaoCategoria?: string | null }).sugestaoCategoria;
        const sugestaoTrim = typeof sugestao === "string" ? sugestao.trim() : "";
        if (sugestaoTrim && naturezasAtivas.has(sugestaoTrim)) {
          naturezaResolvida = sugestaoTrim;
          origemNatureza = "ia";
        } else {
          const camposMatch = {
            tp_despesa: camposFinal.tp_despesa,
            tp_documento_despesa: camposFinal.tp_documento_despesa,
            cd_modalidade_compra: camposFinal.cd_modalidade_compra,
            tp_documento_pagamento: camposFinal.tp_documento_pagamento,
            tp_doc_fav: camposFinal.tp_doc_fav,
            nr_doc_fav: camposFinal.nr_doc_fav,
            nm_favorecido: camposFinal.nm_favorecido,
          };
          const regraNat = regrasOrg
            .filter((r) => r.ativo && r.set_natureza_codigo && naturezasAtivas.has(r.set_natureza_codigo))
            .sort((a, b) => a.prioridade - b.prioridade)
            .find((r) => {
              if (r.match_tp_despesa == null && r.match_tp_documento == null && !r.match_favorecido_regex) return false;
              if (r.match_tp_despesa != null && camposMatch.tp_despesa !== r.match_tp_despesa) return false;
              if (r.match_tp_documento != null && camposMatch.tp_documento_despesa !== r.match_tp_documento) return false;
              if (r.match_favorecido_regex) {
                try {
                  if (!new RegExp(r.match_favorecido_regex, "i").test(camposMatch.nm_favorecido ?? "")) return false;
                } catch { return false; }
              }
              return true;
            });
          if (regraNat?.set_natureza_codigo) {
            naturezaResolvida = regraNat.set_natureza_codigo;
            origemNatureza = "regra_fornecedor";
          }
        }

        const evIns = await supabaseAdmin
          .from("eventos_financeiros")
          .insert({
            organization_id: orgId,
            mes_referencia: mesRef,
            categoria,
            descricao,
            fornecedor_id: fornEncontrado?.id ?? null,
            valor_previsto: valorNum,
            valor_efetivo: temPagamento ? valorNum : null,
            data_vencimento: dataVenc,
            data_pagamento: dataPag,
            data_emissao: dados.data_emissao ?? null,
            origem: "captura",
            tp_documento_despesa: camposFinal.tp_documento_despesa,
            tp_doc_fav: camposFinal.tp_doc_fav,
            nr_doc_fav: camposFinal.nr_doc_fav,
            nm_favorecido: camposFinal.nm_favorecido,
            nr_documento: dados.numero ?? null,
            tp_documento_pagamento: camposFinal.tp_documento_pagamento,
            nr_documento_pagamento: nrDocPagamento,
            tp_despesa: camposFinal.tp_despesa,
            cd_modalidade_compra: camposFinal.cd_modalidade_compra,
            natureza_despesa_codigo: naturezaResolvida,
            status_documental: marcarDuplicata ? "revisar" : (valorNum && (temPagamento || dataVenc) ? "completo" : "revisar"),
            metadata: {
              tipo: dados.tipo,
              cnpj_extraido: dados.cnpj,
              razao_social_extraida: dados.razao_social,
              numero_extraido: dados.numero,
              data_emissao: dados.data_emissao,
              data_pagamento_extraida: dados.data_pagamento,
              forma_pagamento: dados.forma_pagamento,
              nome_arquivo: nomeArquivo,
              criado_via: "captura",
              duplicata: marcarDuplicata,
              multi_doc_index: listaDados.length > 1 ? idx + 1 : null,
              multi_doc_total: listaDados.length > 1 ? listaDados.length : null,
              precisa_revisao: marcarDuplicata || !valorNum,
              motivo_revisao: marcarDuplicata ? "Arquivo duplicado — revisar manualmente"
                : (!valorNum ? "Valor não extraído" : null),
              origem_natureza: origemNatureza,
            },
          })
          .select("id")
          .single();
        if (evIns.error) throw evIns.error;
        eventoId = evIns.data.id;
        eventoCriado = true;
        contadorCriados++;
      } else {
        contadorVinculados++;
      }

      // Anexo (o mesmo arquivo do Storage é anexado a cada evento do lote)
      const anexo = await supabaseAdmin
        .from("documentos_anexos")
        .insert({
          organization_id: orgId,
          tipo: dados.tipo ?? "outro",
          arquivo_url: signed?.signedUrl ?? null,
          arquivo_hash: hash,
          cnpj_extraido: dados.cnpj,
          valor_extraido: dados.valor,
          numero_extraido: dados.numero,
          data_extraida: dados.data_emissao ?? dados.data_vencimento ?? dados.data_pagamento ?? null,
          origem: "manual",
          evento_id: eventoId,
          metadata: {
            nome_original: nomeArquivo,
            descricao: dados.descricao,
            storage_path: path,
            bucket: "documentos",
            duplicata: marcarDuplicata,
            multi_doc_index: listaDados.length > 1 ? idx + 1 : null,
            multi_doc_total: listaDados.length > 1 ? listaDados.length : null,
          },
        })
        .select("id")
        .single();
      if (anexo.error) throw anexo.error;

      if (eventoId && !eventoCriado) {
        await supabaseAdmin
          .from("eventos_financeiros")
          .update({ status_documental: "completo" })
          .eq("id", eventoId);
      }

      ultimoEventoId = eventoId;
      ultimoAnexoId = anexo.data.id;
    }

    const partes: string[] = [];
    if (contadorCriados > 0) partes.push(`${contadorCriados} evento(s) criado(s)`);
    if (contadorVinculados > 0) partes.push(`${contadorVinculados} vinculado(s)`);
    if (ehDuplicata) partes.push("arquivo duplicado");
    const mensagemFinal = partes.join(" · ") || "Concluído";

    await supabaseAdmin
      .from("captura_jobs")
      .update({
        status: "concluido",
        mensagem: mensagemFinal,
        evento_id: ultimoEventoId,
        documento_id: ultimoAnexoId,
        dados: { documentos: listaDados } as unknown as never,
        finalizado_em: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (e) {
    console.error("[captura-worker] job falhou", jobId, e);
    await marcarErro(jobId, msgErro(e));
  }
}


/** Reivindica todos os `pendente` mais antigos e processa em paralelo (limite N). */
export async function processarPendentes(limite = 5): Promise<{ processados: number }> {
  const { data } = await supabaseAdmin
    .from("captura_jobs")
    .select("id")
    .eq("status", "pendente")
    .order("criado_em", { ascending: true })
    .limit(limite);
  if (!data || !data.length) return { processados: 0 };
  await Promise.allSettled(data.map((j) => processarCapturaJob(j.id)));
  return { processados: data.length };
}
