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

/** Baixa mídia binária pela API do Drive (arquivo comum, não-Google). */
async function downloadDriveMedia(fileId: string): Promise<{ bytes: Uint8Array; mimeType: string; name: string }> {
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
  const r = await fetch(`${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: driveHeaders(),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Drive download falhou [${r.status}]: ${t.slice(0, 300)}`);
  }
  return { bytes: new Uint8Array(await r.arrayBuffer()), mimeType: mt, name: meta.name };
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

    // 0) organização atual
    const { data: orgIdRaw } = await sb.rpc("current_user_org");
    const orgId = orgIdRaw as string | null;
    if (!orgId) throw new Error("Organização não encontrada para o usuário atual.");

    // 1) Template ID
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

    // 2) Documentos cadastrados
    const { data: docs, error: eDocs } = await sb
      .from("prestacao_documentos")
      .select("id, ordem, nome, descricao, arquivo_url, drive_file_id, data_emissao, data_vencimento, mime_type")
      .eq("organization_id", orgId)
      .eq("mes_referencia", mes)
      .order("ordem", { ascending: true });
    if (eDocs) throw new Error("Erro ao buscar documentos: " + eDocs.message);

    // 3) Eventos financeiros do mês + anexos
    const { data: eventos, error: eEv } = await sb
      .from("eventos_financeiros")
      .select("id, id_interno, categoria, descricao, nm_favorecido, valor_efetivo, valor_previsto, data_pagamento, data_vencimento")
      .eq("organization_id", orgId)
      .eq("mes_referencia", mes)
      .is("excluido_em", null)
      .order("data_pagamento", { ascending: true, nullsFirst: false })
      .order("id_interno", { ascending: true });
    if (eEv) throw new Error("Erro ao buscar eventos: " + eEv.message);

    const eventoIds = (eventos ?? []).map((e) => e.id);
    let anexosPorEvento = new Map<string, Array<{ id: string; tipo: string; arquivo_url: string | null; drive_file_id: string | null }>>();
    if (eventoIds.length) {
      const { data: anexos, error: eAn } = await sb
        .from("documentos_anexos")
        .select("id, evento_id, tipo, arquivo_url, drive_file_id")
        .in("evento_id", eventoIds);
      if (eAn) throw new Error("Erro ao buscar anexos: " + eAn.message);
      for (const a of anexos ?? []) {
        if (!a.evento_id) continue;
        const arr = anexosPorEvento.get(a.evento_id) ?? [];
        arr.push(a as any);
        anexosPorEvento.set(a.evento_id, arr);
      }
    }

    const totalComprovantes = Array.from(anexosPorEvento.values()).reduce((s, a) => s + a.length, 0);
    if ((docs?.length ?? 0) === 0 && totalComprovantes === 0) {
      throw new Error(`Nenhum documento nem comprovante encontrado para ${mes}.`);
    }

    // 4) Monta lista do sumário (na mesma ordem em que serão anexados)
    const sumarioItens: SumarioItem[] = [];
    sumarioItens.push({ numero: "0.", titulo: "Capa / Template", subtitulo: "Modelo institucional configurado" });
    let n = 1;
    for (const d of docs ?? []) {
      const partes: string[] = [];
      if (d.data_emissao) partes.push(`Emissão: ${fmtDate(d.data_emissao)}`);
      if (d.data_vencimento) partes.push(`Vencimento: ${fmtDate(d.data_vencimento)}`);
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

    // 5a) template
    let templateBytes: Uint8Array;
    try {
      templateBytes = await exportGoogleFileAsPdf(templateId);
    } catch (err) {
      // se não for Google-native, tenta download direto (pode ser um PDF no Drive)
      const meta = await downloadDriveMedia(templateId).catch(() => null);
      if (meta && isPdfBytes(meta.bytes)) {
        templateBytes = meta.bytes;
      } else {
        throw err;
      }
    }
    await addPdf(templateBytes, "Template");

    // 5b) sumário
    const sumarioBytes = await montarSumario({
      mes,
      titulo: data.titulo ?? `Prestação de Contas — ${mes}`,
      itens: sumarioItens,
      totalDocs: docs?.length ?? 0,
      totalComprovantes,
    });
    await addPdf(sumarioBytes, "Sumário");

    // 5c) documentos cadastrados
    for (const d of docs ?? []) {
      const label = d.nome;
      try {
        let bytes: Uint8Array;
        let mime = d.mime_type ?? "";
        if (d.drive_file_id) {
          const got = await downloadDriveMedia(d.drive_file_id);
          bytes = got.bytes; mime = got.mimeType;
        } else if (d.arquivo_url) {
          const got = await fetchAsBytes(d.arquivo_url);
          bytes = got.bytes; mime = got.mimeType;
        } else {
          await addPdf(await paginaErro(label, "Sem URL nem drive_file_id"), label);
          continue;
        }
        if (isPdfBytes(bytes)) {
          await addPdf(bytes, label);
        } else if (mime.startsWith("image/") || bytes[0] === 0x89 || bytes[0] === 0xff) {
          const pdfBytes = await imageToPdf(bytes, mime);
          await addPdf(pdfBytes, label);
        } else {
          const linkOrig = d.arquivo_url ? `Link original: ${d.arquivo_url}` : "";
          await addPdf(
            await paginaSeparadora({
              titulo: `Documento: ${label}`,
              linhas: [
                `Tipo: ${mime || "desconhecido"} — não pode ser convertido automaticamente para PDF.`,
                linkOrig,
              ].filter(Boolean),
            }),
            label,
          );
        }
      } catch (err) {
        await addPdf(await paginaErro(label, String((err as Error).message ?? err)), label);
      }
    }

    // 5d) comprovantes por evento
    for (const e of eventos ?? []) {
      const anexos = anexosPorEvento.get(e.id) ?? [];
      if (!anexos.length) continue;
      const sepBytes = await paginaSeparadora({
        titulo: `Comprovante #${e.id_interno ?? ""} — ${e.descricao ?? e.categoria}`,
        linhas: [
          `Favorecido: ${e.nm_favorecido ?? "—"}`,
          `Valor: ${fmtBRL(e.valor_efetivo ?? e.valor_previsto)}`,
          `Vencimento: ${fmtDate(e.data_vencimento)}   Pagamento: ${fmtDate(e.data_pagamento)}`,
          `Anexos: ${anexos.length}`,
        ],
      });
      await addPdf(sepBytes, `Separador ${e.id_interno}`);

      for (const a of anexos) {
        const label = `Anexo ${a.tipo} (${e.id_interno ?? ""})`;
        try {
          let bytes: Uint8Array;
          let mime = "";
          if (a.drive_file_id) {
            const got = await downloadDriveMedia(a.drive_file_id);
            bytes = got.bytes; mime = got.mimeType;
          } else if (a.arquivo_url) {
            const got = await fetchAsBytes(a.arquivo_url);
            bytes = got.bytes; mime = got.mimeType;
          } else {
            await addPdf(await paginaErro(label, "Sem URL nem drive_file_id"), label);
            continue;
          }
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
    }

    const finalBytes = await merged.save();

    // 6) Upload no Drive na pasta Prestações/{mes}
    const parents = await ensureMesFolder(orgId, "Prestações", mes)
      .then((id) => [id])
      .catch(() => undefined);
    const nome = `Prestacao de Contas — ${mes}${data.titulo ? ` — ${data.titulo}` : ""}.pdf`;
    const uploaded = await driveUploadPdf({ name: nome, parents, bytes: finalBytes });

    return {
      fileId: uploaded.id,
      url: uploaded.webViewLink,
      nome: uploaded.name,
      totalPaginas: merged.getPageCount(),
      totalDocs: docs?.length ?? 0,
      totalComprovantes,
    };
  });
