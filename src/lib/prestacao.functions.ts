/**
 * Prestação de Contas — gera um PDF ÚNICO mesclado contendo:
 *   1. Template (Google Docs) exportado como PDF
 *   2. Sumário/relação de documentos
 *   3. Documentos cadastrados em prestacao_documentos (PDFs íntegros)
 *   4. Comprovantes anexados aos eventos financeiros do mês
 *
 * O PDF final é salvo no Drive (Prestações/{mes}) e retornado ao usuário.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureMesFolder } from "./drive-org.server";
import { extrairSheetId } from "./modelos";

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";

function driveHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const drv = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!drv) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte o Google Drive em Connectors.");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": drv };
}

async function jsonOrThrow(res: Response, ctx: string): Promise<any> {
  const txt = await res.text();
  if (!res.ok) throw new Error(`${ctx} falhou [${res.status}]: ${txt.slice(0, 400)}`);
  try { return JSON.parse(txt); } catch { return {}; }
}

/** Exporta um Google Docs/Sheets/Slides como PDF via Drive API. */
async function exportGoogleFileAsPdf(fileId: string): Promise<Uint8Array> {
  const res = await fetch(
    `${DRIVE}/files/${fileId}/export?mimeType=${encodeURIComponent("application/pdf")}`,
    { headers: driveHeaders() },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Drive export falhou [${res.status}]: ${t.slice(0, 300)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Baixa mídia binária pela API do Drive (arquivo comum ou Google Doc nativo). */
async function downloadDriveMedia(fileId: string): Promise<{ bytes: Uint8Array; mimeType: string; name: string }> {
  // Tenta direto ?alt=media (arquivos comuns). Uma única requisição, sem metadata prévia.
  const r = await fetch(`${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: driveHeaders(),
  });
  if (r.ok) {
    const mt = r.headers.get("content-type") ?? "application/octet-stream";
    const cd = r.headers.get("content-disposition") ?? "";
    const name = cd.match(/filename="?([^"]+)"?/)?.[1] ?? fileId;
    return { bytes: new Uint8Array(await r.arrayBuffer()), mimeType: mt, name };
  }
  // Fallback: Google Doc/Sheet/Slide nativo → precisa export
  const metaRes = await fetch(
    `${DRIVE}/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`,
    { headers: driveHeaders() },
  );
  const meta = await jsonOrThrow(metaRes, "drive.files.get");
  const mt: string = meta.mimeType ?? "";
  if (mt.startsWith("application/vnd.google-apps.")) {
    const bytes = await exportGoogleFileAsPdf(fileId);
    return { bytes, mimeType: "application/pdf", name: meta.name };
  }
  const t = await r.text().catch(() => "");
  throw new Error(`Drive download falhou [${r.status}]: ${t.slice(0, 300)}`);
}

/** Executa `fn` sobre `items` com no máximo `concurrency` promessas em paralelo. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Upload multipart de bytes para o Drive. */
async function driveUploadPdf(args: {
  name: string;
  parents?: string[];
  bytes: Uint8Array;
}): Promise<{ id: string; webViewLink: string; name: string }> {
  const boundary = "approva-boundary-" + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const metadata = JSON.stringify({
    name: args.name,
    parents: args.parents,
    mimeType: "application/pdf",
  });
  const preamble = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  );
  const closing = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(preamble.length + args.bytes.length + closing.length);
  body.set(preamble, 0);
  body.set(args.bytes, preamble.length);
  body.set(closing, preamble.length + args.bytes.length);

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { ...driveHeaders(), "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const data = await jsonOrThrow(res, "drive.files.create(upload)");
  if (!data.webViewLink) {
    const res2 = await fetch(`${DRIVE}/files/${data.id}?fields=id,name,webViewLink`, {
      headers: driveHeaders(),
    });
    const meta = await jsonOrThrow(res2, "drive.files.get");
    return { id: data.id, name: data.name, webViewLink: meta.webViewLink };
  }
  return { id: data.id, name: data.name, webViewLink: data.webViewLink };
}

/** Extrai file ID a partir de URL do Drive (docs, sheets, slides, files). */
function driveIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.trim();
  const m =
    s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    s.match(/\/document\/d\/([a-zA-Z0-9_-]+)/) ||
    s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) ||
    s.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/) ||
    s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Baixa qualquer URL. Prefere Drive quando reconhecido. */
async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string; name: string }> {
  const driveId = driveIdFromUrl(url);
  if (driveId) return downloadDriveMedia(driveId);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download falhou [${r.status}]`);
  const mt = r.headers.get("content-type") ?? "application/octet-stream";
  const nome = url.split("/").pop()?.split("?")[0] ?? "arquivo";
  return { bytes: new Uint8Array(await r.arrayBuffer()), mimeType: mt, name: nome };
}

function isPdfBytes(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
}

/** Converte imagem (jpg/png) em PDF de 1 página A4 com a imagem centralizada. */
async function imageToPdf(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const isPng = mime.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
  const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const page = pdf.addPage([595, 842]); // A4
  const margin = 40;
  const maxW = 595 - margin * 2;
  const maxH = 842 - margin * 2;
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  page.drawImage(img, {
    x: (595 - w) / 2,
    y: (842 - h) / 2,
    width: w,
    height: h,
  });
  return pdf.save();
}

/* ============================== SUMÁRIO / SEPARADORES ============================== */

const A4: [number, number] = [595, 842];

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

/** Remove caracteres que WinAnsi (Helvetica) não suporta. */
function toWinAnsi(s: string): string {
  return s.normalize("NFC").replace(/[^\x00-\xff]/g, "?");
}

function drawWrapped(page: PDFPage, text: string, opts: {
  x: number; y: number; size: number; font: PDFFont; maxWidth: number; lineHeight?: number; color?: ReturnType<typeof rgb>;
}): number {
  const words = toWinAnsi(text).split(/\s+/);
  const lh = opts.lineHeight ?? opts.size * 1.3;
  let line = "";
  let y = opts.y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    const width = opts.font.widthOfTextAtSize(test, opts.size);
    if (width > opts.maxWidth && line) {
      page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color ?? rgb(0, 0, 0) });
      line = w;
      y -= lh;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color ?? rgb(0, 0, 0) });
    y -= lh;
  }
  return y;
}

type SumarioItem = { numero: string; titulo: string; subtitulo?: string };

async function montarSumario(opts: { mes: string; titulo: string; itens: SumarioItem[]; totalDocs: number; totalComprovantes: number }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage(A4);
  let y = 800;

  page.drawText(toWinAnsi("PRESTAÇÃO DE CONTAS"), { x: 50, y, size: 20, font: bold });
  y -= 26;
  page.drawText(toWinAnsi(opts.titulo), { x: 50, y, size: 12, font: body, color: rgb(0.35, 0.35, 0.35) });
  y -= 22;
  page.drawText(toWinAnsi(`Mês de referência: ${opts.mes}   ·   ${opts.totalDocs} documentos   ·   ${opts.totalComprovantes} comprovantes`), {
    x: 50, y, size: 10, font: body, color: rgb(0.3, 0.3, 0.3),
  });
  y -= 24;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;

  page.drawText(toWinAnsi("SUMÁRIO"), { x: 50, y, size: 13, font: bold });
  y -= 20;

  for (const it of opts.itens) {
    if (y < 80) { page = pdf.addPage(A4); y = 800; }
    page.drawText(toWinAnsi(it.numero), { x: 50, y, size: 10, font: bold });
    const yTitulo = y;
    y = drawWrapped(page, it.titulo, { x: 90, y, size: 10, font: body, maxWidth: 455 });
    if (it.subtitulo) {
      y = drawWrapped(page, it.subtitulo, { x: 90, y, size: 8, font: body, maxWidth: 455, color: rgb(0.45, 0.45, 0.45) });
    }
    // linha divisória sutil
    y -= 4;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
    y -= 8;
    void yTitulo;
  }
  return pdf.save();
}

async function paginaSeparadora(opts: { titulo: string; linhas: string[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage(A4);
  let y = 500;
  page.drawText(toWinAnsi(opts.titulo), { x: 50, y, size: 16, font: bold });
  y -= 30;
  for (const l of opts.linhas) {
    y = drawWrapped(page, l, { x: 50, y, size: 11, font: body, maxWidth: 495, color: rgb(0.25, 0.25, 0.25) });
    y -= 4;
  }
  return pdf.save();
}

async function paginaErro(nome: string, motivo: string): Promise<Uint8Array> {
  return paginaSeparadora({
    titulo: `⚠ Não foi possível anexar: ${nome}`,
    linhas: [`Motivo: ${motivo}`, "O documento original permanece disponível no sistema."],
  });
}

/* ============================== PIPELINE ============================== */

const TIPO_ORDEM: Record<string, number> = { nf: 0, boleto: 1, comprovante: 2 };

/** Retorna documentos que devem entrar no PDF do mês, considerando vigência e exceções. */
async function buscarDocumentosVigentes(sb: any, orgId: string, mes: string): Promise<any[]> {
  const primeiroDia = `${mes}-01`;
  const { data, error } = await sb
    .from("prestacao_documentos")
    .select("id, ordem, nome, descricao, arquivo_url, drive_file_id, data_emissao, data_vencimento, mime_type, mes_referencia, mes_referencia_fim, valido_de, valido_ate")
    .eq("organization_id", orgId)
    .lte("mes_referencia", mes)
    .or(`mes_referencia_fim.is.null,mes_referencia_fim.gte.${mes}`)
    .or(`valido_ate.is.null,valido_ate.gte.${primeiroDia}`)
    .order("ordem", { ascending: true });
  if (error) throw new Error("Erro ao buscar documentos: " + error.message);
  const docs = (data ?? []) as any[];
  if (docs.length === 0) return docs;

  // Filtra exceções: documentos marcados como "pular neste mês"
  const ids = docs.map((d) => d.id);
  const { data: exc } = await sb
    .from("prestacao_documentos_excecoes")
    .select("documento_id")
    .in("documento_id", ids)
    .eq("mes_referencia", mes);
  const excluidos = new Set((exc ?? []).map((e: any) => e.documento_id));
  return docs.filter((d) => !excluidos.has(d.id));
}

/**
 * Monta o PDF único (template + sumário + documentos + comprovantes) e devolve os bytes.
 * Usado tanto pelo endpoint oficial quanto pelo preview.
 */
export async function montarPdfBytes(args: {
  sb: any;
  orgId: string;
  mes: string;
  titulo?: string;
}): Promise<{ bytes: Uint8Array; totalPaginas: number; totalDocs: number; totalComprovantes: number }> {
  const { sb, orgId, mes } = args;

  // 1) Template
  const { data: cfg } = await sb
    .from("configuracoes")
    .select("valor")
    .eq("organization_id", orgId)
    .eq("chave", "prestacao_template")
    .maybeSingle();
  const templateIdRaw = (cfg?.valor as any)?.template_id as string | undefined;
  if (!templateIdRaw) {
    throw new Error("Template de Prestação de Contas não configurado em Admin → Configurações.");
  }
  const templateId = extrairSheetId(templateIdRaw);

  // 2) Documentos (com regra de vigência)
  const docs = await buscarDocumentosVigentes(sb, orgId, mes);

  // 3) Eventos + anexos do mês
  const { data: eventos, error: eEv } = await sb
    .from("eventos_financeiros")
    .select("id, id_interno, categoria, descricao, nm_favorecido, valor_efetivo, valor_previsto, data_pagamento, data_vencimento")
    .eq("organization_id", orgId)
    .eq("mes_referencia", mes)
    .is("excluido_em", null)
    .order("data_pagamento", { ascending: true, nullsFirst: false })
    .order("id_interno", { ascending: true });
  if (eEv) throw new Error("Erro ao buscar eventos: " + eEv.message);

  const eventoIds = (eventos ?? []).map((e: any) => e.id);
  const anexosPorEvento = new Map<string, Array<{ id: string; tipo: string; arquivo_url: string | null; drive_file_id: string | null }>>();
  if (eventoIds.length) {
    const { data: anexos, error: eAn } = await sb
      .from("documentos_anexos")
      .select("id, evento_id, tipo, arquivo_url, drive_file_id")
      .in("evento_id", eventoIds);
    if (eAn) throw new Error("Erro ao buscar anexos: " + eAn.message);
    for (const a of (anexos ?? []) as any[]) {
      if (!a.evento_id) continue;
      const arr = anexosPorEvento.get(a.evento_id) ?? [];
      arr.push(a);
      anexosPorEvento.set(a.evento_id, arr);
    }
    // Ordena anexos por tipo dentro de cada evento
    for (const arr of anexosPorEvento.values()) {
      arr.sort((a, b) => (TIPO_ORDEM[a.tipo] ?? 99) - (TIPO_ORDEM[b.tipo] ?? 99));
    }
  }

  const totalComprovantes = Array.from(anexosPorEvento.values()).reduce((s, a) => s + a.length, 0);
  if ((docs?.length ?? 0) === 0 && totalComprovantes === 0) {
    throw new Error(`Nenhum documento nem comprovante encontrado para ${mes}.`);
  }

  // 4) Sumário
  const sumarioItens: SumarioItem[] = [];
  sumarioItens.push({ numero: "0.", titulo: "Capa / Template", subtitulo: "Modelo institucional configurado" });
  let n = 1;
  for (const d of docs) {
    const partes: string[] = [];
    if (d.data_emissao) partes.push(`Emissão: ${fmtDate(d.data_emissao)}`);
    if (d.valido_ate) partes.push(`Válido até: ${fmtDate(d.valido_ate)}`);
    else if (d.data_vencimento) partes.push(`Vencimento: ${fmtDate(d.data_vencimento)}`);
    sumarioItens.push({
      numero: `${n}.`,
      titulo: d.nome,
      subtitulo: [d.descricao ?? "", partes.join(" · ")].filter(Boolean).join(" — "),
    });
    n++;
  }
  for (const e of eventos ?? []) {
    const anexos = anexosPorEvento.get(e.id) ?? [];
    if (!anexos.length) continue;
    const val = fmtBRL(e.valor_efetivo ?? e.valor_previsto);
    const fav = e.nm_favorecido ?? "—";
    const dt = fmtDate(e.data_pagamento ?? e.data_vencimento);
    sumarioItens.push({
      numero: `${n}.`,
      titulo: `Comprovante #${e.id_interno ?? ""} — ${e.descricao ?? e.categoria}`,
      subtitulo: `${fav} · ${val} · ${dt} · ${anexos.length} anexo(s)`,
    });
    n++;
  }

  // 5) Merge
  const merged = await PDFDocument.create();
  const addPdf = async (bytes: Uint8Array, label: string): Promise<boolean> => {
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
      return true;
    } catch (err) {
      console.warn(`[prestacao] falha ao mesclar ${label}:`, err);
      const errBytes = await paginaErro(label, String((err as Error).message ?? err));
      try {
        const src = await PDFDocument.load(errBytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } catch {}
      return false;
    }
  };

  // ============ FASE DE DOWNLOAD (paralela) ============
  // Prepara jobs para: template, cada documento cadastrado, cada anexo de evento.
  type Job =
    | { kind: "template" }
    | { kind: "doc"; label: string; driveId: string | null; url: string | null; mime: string }
    | { kind: "anexo"; label: string; driveId: string | null; url: string | null };

  const jobs: Job[] = [];
  jobs.push({ kind: "template" });
  for (const d of docs) {
    jobs.push({
      kind: "doc",
      label: d.nome,
      driveId: d.drive_file_id ?? null,
      url: d.arquivo_url ?? null,
      mime: d.mime_type ?? "",
    });
  }
  for (const e of eventos ?? []) {
    for (const a of anexosPorEvento.get(e.id) ?? []) {
      jobs.push({
        kind: "anexo",
        label: `Anexo ${a.tipo} (${e.id_interno ?? ""})`,
        driveId: a.drive_file_id ?? null,
        url: a.arquivo_url ?? null,
      });
    }
  }

  console.time("[prestacao] download");
  type Downloaded = { label: string; ok: boolean; bytes?: Uint8Array; mime?: string; error?: string };
  const downloaded = await mapPool(jobs, 6, async (job): Promise<Downloaded> => {
    try {
      if (job.kind === "template") {
        try {
          const bytes = await exportGoogleFileAsPdf(templateId);
          return { label: "Template", ok: true, bytes, mime: "application/pdf" };
        } catch (err) {
          const got = await downloadDriveMedia(templateId);
          if (!isPdfBytes(got.bytes)) throw err;
          return { label: "Template", ok: true, bytes: got.bytes, mime: got.mimeType };
        }
      }
      if (!job.driveId && !job.url) {
        return { label: job.label, ok: false, error: "Sem URL nem drive_file_id" };
      }
      const got = job.driveId
        ? await downloadDriveMedia(job.driveId)
        : await fetchAsBytes(job.url!);
      return { label: job.label, ok: true, bytes: got.bytes, mime: got.mimeType };
    } catch (err) {
      const lbl = job.kind === "template" ? "Template" : job.label;
      return { label: lbl, ok: false, error: String((err as Error).message ?? err) };
    }
  });
  console.timeEnd("[prestacao] download");

  // ============ FASE DE MERGE (sequencial, mas sem IO) ============
  console.time("[prestacao] merge");

  // 5a) template
  const tpl = downloaded[0];
  if (!tpl.ok || !tpl.bytes) {
    throw new Error(`Falha ao baixar template: ${tpl.error ?? "desconhecido"}`);
  }
  await addPdf(tpl.bytes, "Template");

  // 5b) sumário
  const sumarioBytes = await montarSumario({
    mes,
    titulo: args.titulo ?? `Prestação de Contas — ${mes}`,
    itens: sumarioItens,
    totalDocs: docs.length,
    totalComprovantes,
  });
  await addPdf(sumarioBytes, "Sumário");

  // 5c/5d) resto na ordem original (docs + anexos)
  for (let i = 1; i < downloaded.length; i++) {
    const item = downloaded[i];
    const label = item.label;
    if (!item.ok || !item.bytes) {
      await addPdf(await paginaErro(label, item.error ?? "erro"), label);
      continue;
    }
    const bytes = item.bytes;
    const mime = item.mime ?? "";
    try {
      if (isPdfBytes(bytes)) {
        await addPdf(bytes, label);
      } else if (mime.startsWith("image/") || bytes[0] === 0x89 || bytes[0] === 0xff) {
        const pdfBytes = await imageToPdf(bytes, mime);
        await addPdf(pdfBytes, label);
      } else {
        await addPdf(
          await paginaSeparadora({
            titulo: label,
            linhas: [`Tipo ${mime || "desconhecido"} — não convertido automaticamente.`],
          }),
          label,
        );
      }
    } catch (err) {
      await addPdf(await paginaErro(label, String((err as Error).message ?? err)), label);
    }
  }
  console.timeEnd("[prestacao] merge");

  const finalBytes = await merged.save();
  return {
    bytes: finalBytes,
    totalPaginas: merged.getPageCount(),
    totalDocs: docs.length,
    totalComprovantes,
  };
}

/* ============================== SERVER FN ============================== */

const Input = z.object({
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
  titulo: z.string().max(200).optional(),
});

export const gerarPrestacaoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const mes = data.mesReferencia;

    const { data: orgIdRaw } = await sb.rpc("current_user_org");
    const orgId = orgIdRaw as string | null;
    if (!orgId) throw new Error("Organização não encontrada para o usuário atual.");

    const result = await montarPdfBytes({ sb, orgId, mes, titulo: data.titulo });
    const nome = `Prestacao de Contas — ${mes}${data.titulo ? ` — ${data.titulo}` : ""}.pdf`;

    // Upload paralelo: Storage (primário, para viewer direto) + Drive (backup institucional).
    // Servir do Storage evita o redirect para drive.usercontent.google.com, que costuma
    // ser bloqueado por navegadores/extensões (ERR_BLOCKED_BY_RESPONSE).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `${orgId}/${mes}/${stamp}.pdf`;

    console.time("[prestacao] upload");
    const [storageRes, driveRes] = await Promise.allSettled([
      (async () => {
        const up = await supabaseAdmin.storage
          .from("prestacoes")
          .upload(storagePath, result.bytes, { contentType: "application/pdf", upsert: true });
        if (up.error) throw up.error;
        const signed = await supabaseAdmin.storage
          .from("prestacoes")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        if (signed.error || !signed.data) throw signed.error ?? new Error("sem signed url");
        return signed.data.signedUrl;
      })(),
      (async () => {
        const parents = await ensureMesFolder(orgId, "Prestações", mes)
          .then((id) => [id])
          .catch(() => undefined);
        return driveUploadPdf({ name: nome, parents, bytes: result.bytes });
      })(),
    ]);
    console.timeEnd("[prestacao] upload");

    if (storageRes.status === "rejected" && driveRes.status === "rejected") {
      throw new Error("Falha ao salvar o PDF (Storage e Drive): " + String(storageRes.reason));
    }

    const signedUrl = storageRes.status === "fulfilled" ? storageRes.value : null;
    const drive = driveRes.status === "fulfilled" ? driveRes.value : null;

    return {
      // Link primário — abre direto no navegador sem passar por drive.usercontent.google.com
      url: signedUrl ?? drive!.webViewLink,
      driveUrl: drive?.webViewLink ?? null,
      fileId: drive?.id ?? null,
      nome,
      totalPaginas: result.totalPaginas,
      totalDocs: result.totalDocs,
      totalComprovantes: result.totalComprovantes,
    };
  });

