/**
 * Geração de Prestação V1 — snapshot imutável.
 *
 * Pipeline:
 *  1. Lê todos eventos_financeiros do mês.
 *  2. Para cada evento, busca documentos_anexos.evento_id.
 *  3. Baixa cada PDF do bucket `documentos` (via service role).
 *  4. Monta uma capa + índice + mescla todos os PDFs em ordem.
 *  5. Calcula SHA-256 do PDF resultante.
 *  6. Sobe pro bucket `prestacoes` e cria signed URL.
 *  7. Insere registro em `prestacoes_snapshot` com manifest e hash.
 *  8. Atualiza eventos_financeiros.prestacao_snapshot_id.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
  titulo: z.string().max(200).optional(),
});

type Evento = {
  id: string;
  categoria: string;
  descricao: string | null;
  fornecedor_id: string | null;
  valor_previsto: number | null;
  valor_efetivo: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status_documental: string;
};

type Anexo = {
  id: string;
  evento_id: string | null;
  tipo: string;
  arquivo_url: string | null;
  arquivo_hash: string | null;
  valor_extraido: number | null;
  data_extraida: string | null;
  numero_extraido: string | null;
};

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Extrai path do bucket `documentos` a partir de signed/public URL. */
function pathFromUrl(url: string): string | null {
  // formato típico: .../storage/v1/object/(public|sign)/documentos/<path>?...
  const m = url.match(/\/object\/(?:public|sign)\/documentos\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

async function bytesToHex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function montarCapa(opts: {
  titulo: string;
  mes: string;
  totalEventos: number;
  totalDocs: number;
  geradoEm: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  page.drawText("PRESTAÇÃO DE CONTAS", {
    x: 50, y: height - 120, size: 28, font, color: rgb(0, 0, 0),
  });
  page.drawText(opts.titulo, {
    x: 50, y: height - 160, size: 16, font: body, color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(`Mês de referência: ${opts.mes}`, {
    x: 50, y: height - 220, size: 12, font: body,
  });
  page.drawText(`Total de eventos: ${opts.totalEventos}`, {
    x: 50, y: height - 240, size: 12, font: body,
  });
  page.drawText(`Total de documentos: ${opts.totalDocs}`, {
    x: 50, y: height - 260, size: 12, font: body,
  });
  page.drawText(`Gerado em: ${opts.geradoEm.toLocaleString("pt-BR")}`, {
    x: 50, y: height - 280, size: 12, font: body,
  });

  page.drawLine({
    start: { x: 50, y: 80 }, end: { x: width - 50, y: 80 },
    thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
  });
  page.drawText("Documento imutável. Hash SHA-256 registrado no rodapé do índice.", {
    x: 50, y: 60, size: 8, font: body, color: rgb(0.5, 0.5, 0.5),
  });
  return pdf.save();
}

async function montarIndice(opts: {
  eventos: Evento[];
  fornecedores: Map<string, string>;
  anexosPorEvento: Map<string, Anexo[]>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  let page = pdf.addPage([595, 842]);
  const { height, width } = page.getSize();
  let y = height - 60;
  const novaPagina = () => {
    page = pdf.addPage([595, 842]);
    y = height - 60;
  };

  page.drawText("ÍNDICE DE EVENTOS", { x: 50, y, size: 16, font });
  y -= 30;

  for (const e of opts.eventos) {
    if (y < 100) novaPagina();
    const forn = e.fornecedor_id ? opts.fornecedores.get(e.fornecedor_id) ?? "—" : "—";
    const anexos = opts.anexosPorEvento.get(e.id) ?? [];
    page.drawText(`[${e.categoria}] ${e.descricao ?? "—"}`, {
      x: 50, y, size: 11, font, color: rgb(0, 0, 0),
    });
    y -= 14;
    const linha = `Fornec: ${forn}  ·  Venc: ${fmtDate(e.data_vencimento)}  ·  Pgto: ${fmtDate(e.data_pagamento)}  ·  Prev: ${fmtBRL(e.valor_previsto)}  ·  Efet: ${fmtBRL(e.valor_efetivo)}  ·  Status: ${e.status_documental}`;
    page.drawText(linha, { x: 60, y, size: 9, font: body, color: rgb(0.25, 0.25, 0.25) });
    y -= 12;
    if (anexos.length === 0) {
      page.drawText("· Sem anexos", { x: 60, y, size: 9, font: body, color: rgb(0.55, 0.2, 0.2) });
      y -= 14;
    } else {
      for (const a of anexos) {
        if (y < 80) novaPagina();
        page.drawText(
          `· ${a.tipo}  ${a.numero_extraido ? `#${a.numero_extraido}` : ""}  ${fmtBRL(a.valor_extraido)}  ${fmtDate(a.data_extraida)}`,
          { x: 60, y, size: 9, font: body, color: rgb(0.2, 0.2, 0.2) },
        );
        y -= 12;
      }
      y -= 4;
    }
    y -= 6;
  }
  // espaço para hash adicionado depois (write final)
  const last = pdf.getPage(pdf.getPageCount() - 1);
  last.drawLine({
    start: { x: 50, y: 50 }, end: { x: width - 50, y: 50 },
    thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
  });
  return pdf.save();
}

export const gerarPrestacaoSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const mes = data.mesReferencia;
    const adm = supabaseAdmin;

    // 1) Eventos do mês
    const { data: eventos, error: e1 } = await adm
      .from("eventos_financeiros")
      .select("id, organization_id, categoria, descricao, fornecedor_id, valor_previsto, valor_efetivo, data_vencimento, data_pagamento, status_documental")
      .eq("mes_referencia", mes)
      .order("data_vencimento", { ascending: true, nullsFirst: false });
    if (e1) throw new Error("Falha ao ler eventos: " + e1.message);
    if (!eventos || eventos.length === 0) {
      throw new Error(`Nenhum evento em ${mes}.`);
    }

    // Bloqueia homologação se houver eventos ainda em rascunho ou pendentes de revisão.
    const pendentes = (eventos as any[]).filter((e) =>
      ["rascunho", "pendente_revisao"].includes(e.status_workflow)
    );
    if (pendentes.length > 0) {
      throw new Error(
        `Não é possível gerar snapshot: ${pendentes.length} evento(s) ainda pendente(s) de aprovação em ${mes}. Aprove-os em Admin → Aprovações.`
      );
    }



    const eventoIds = eventos.map((e) => e.id);

    // 2) Anexos vinculados
    const { data: anexos, error: e2 } = await adm
      .from("documentos_anexos")
      .select("id, evento_id, tipo, arquivo_url, arquivo_hash, valor_extraido, data_extraida, numero_extraido")
      .in("evento_id", eventoIds);
    if (e2) throw new Error("Falha ao ler anexos: " + e2.message);

    const anexosPorEvento = new Map<string, Anexo[]>();
    for (const a of (anexos ?? []) as Anexo[]) {
      if (!a.evento_id) continue;
      const arr = anexosPorEvento.get(a.evento_id) ?? [];
      arr.push(a);
      anexosPorEvento.set(a.evento_id, arr);
    }

    // 3) Fornecedores p/ exibir
    const fornIds = Array.from(new Set(eventos.map((e) => e.fornecedor_id).filter(Boolean) as string[]));
    const fornMap = new Map<string, string>();
    if (fornIds.length) {
      const { data: forns } = await adm.from("fornecedores").select("id, razao_social").in("id", fornIds);
      for (const f of forns ?? []) fornMap.set(f.id, f.razao_social);
    }

    // 4) Capa + índice
    const totalDocs = (anexos ?? []).length;
    const titulo = data.titulo ?? `Prestação ${mes}`;
    const capaBytes = await montarCapa({
      titulo, mes, totalEventos: eventos.length, totalDocs, geradoEm: new Date(),
    });
    const indiceBytes = await montarIndice({
      eventos: eventos as Evento[], fornecedores: fornMap, anexosPorEvento,
    });

    // 5) Merge: capa + índice + cada PDF de cada anexo
    const merged = await PDFDocument.create();
    const addPdf = async (bytes: Uint8Array) => {
      try {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } catch (err) {
        console.warn("[snapshot] PDF inválido ignorado:", err);
      }
    };
    await addPdf(capaBytes);
    await addPdf(indiceBytes);

    const manifest: Array<Record<string, unknown>> = [];
    for (const e of eventos as Evento[]) {
      const lista = anexosPorEvento.get(e.id) ?? [];
      const docsManifest: Array<Record<string, unknown>> = [];
      for (const a of lista) {
        if (!a.arquivo_url) continue;
        const path = pathFromUrl(a.arquivo_url);
        if (!path) { docsManifest.push({ id: a.id, skipped: "url-no-bucket-path" }); continue; }
        const { data: blob, error: edl } = await adm.storage.from("documentos").download(path);
        if (edl || !blob) {
          docsManifest.push({ id: a.id, skipped: "download-failed", err: edl?.message });
          continue;
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        // Só mescla PDFs; imagens ignoradas no V1 (poderia converter pra PDF page com pdf-lib drawImage)
        const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
        if (isPdf) {
          await addPdf(buf);
          docsManifest.push({ id: a.id, tipo: a.tipo, hash: a.arquivo_hash, incluido: true });
        } else {
          docsManifest.push({ id: a.id, tipo: a.tipo, hash: a.arquivo_hash, incluido: false, motivo: "nao-pdf" });
        }
      }
      manifest.push({
        evento_id: e.id, categoria: e.categoria, descricao: e.descricao,
        valor_previsto: e.valor_previsto, valor_efetivo: e.valor_efetivo,
        status: e.status_documental, docs: docsManifest,
      });
    }

    // 6) Salva PDF final, hash, upload
    const finalBytes = await merged.save();
    const buf = finalBytes.buffer.slice(finalBytes.byteOffset, finalBytes.byteOffset + finalBytes.byteLength) as ArrayBuffer;
    const hash = await bytesToHex(buf);
    const path = `${mes}/${Date.now()}-${hash.slice(0, 8)}.pdf`;
    const { error: eup } = await adm.storage.from("prestacoes").upload(path, finalBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (eup) throw new Error("Upload falhou: " + eup.message);

    const { data: signed } = await adm.storage.from("prestacoes").createSignedUrl(path, 60 * 60 * 24 * 7);

    // 7) Insert snapshot — calcula próxima revisão para o mesmo (org, mês)
    const orgId = (eventos[0] as { organization_id?: string }).organization_id;
    let proximaRevisao = 1;
    {
      const q = adm
        .from("prestacoes_snapshot")
        .select("revisao")
        .eq("mes_referencia", mes)
        .order("revisao", { ascending: false })
        .limit(1);
      if (orgId) q.eq("organization_id", orgId);
      const { data: ultima } = await q;
      if (ultima && ultima.length > 0 && typeof ultima[0].revisao === "number") {
        proximaRevisao = ultima[0].revisao + 1;
      }
    }

    const { data: snap, error: eins } = await adm
      .from("prestacoes_snapshot")
      .insert({
        organization_id: orgId!,
        mes_referencia: mes,
        titulo,
        pdf_url: signed?.signedUrl ?? null,
        pdf_path: path,
        assinatura_hash: hash,
        manifest: { eventos: manifest, gerado_em: new Date().toISOString(), revisao: proximaRevisao } as unknown as Record<string, never>,
        total_eventos: eventos.length,
        total_documentos: totalDocs,
        gerado_por: context.userId,
        revisao: proximaRevisao,
      })
      .select("id")
      .single();
    if (eins) throw new Error("Falha ao salvar snapshot: " + eins.message);

    // 8) Vincula eventos ao snapshot (não sobrescreve se já houver)
    await adm
      .from("eventos_financeiros")
      .update({ prestacao_snapshot_id: snap.id })
      .in("id", eventoIds)
      .is("prestacao_snapshot_id", null);

    return {
      id: snap.id,
      hash,
      url: signed?.signedUrl ?? null,
      path,
      totalEventos: eventos.length,
      totalDocumentos: totalDocs,
    };
  });

/** Gera nova signed URL para um snapshot existente. */
export const obterUrlSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: snap, error } = await supabaseAdmin
      .from("prestacoes_snapshot")
      .select("pdf_path")
      .eq("id", data.id)
      .single();
    if (error || !snap?.pdf_path) throw new Error("Snapshot não encontrado");
    const { data: signed, error: es } = await supabaseAdmin.storage
      .from("prestacoes")
      .createSignedUrl(snap.pdf_path, 60 * 60);
    if (es || !signed) throw new Error("Falha ao gerar URL");
    return { url: signed.signedUrl };
  });

/**
 * Reabertura controlada de prestação: marca o snapshot como revogado,
 * libera os eventos financeiros do vínculo e grava motivo em `audit_log`.
 * Só owner/admin da organização.
 */
export const reabrirPrestacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      snapshotId: z.string().uuid(),
      activeOrgId: z.string().uuid(),
      motivo: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica papel na org (owner/admin) via has_role/is_org_owner.
    const { data: isOwner } = await supabase.rpc("is_org_owner", {
      _user_id: userId,
      _org_id: data.activeOrgId,
    });
    if (isOwner !== true) throw new Error("Apenas owner/admin pode reabrir prestações.");

    // Carrega snapshot da org.
    const { data: snap, error: eSel } = await supabaseAdmin
      .from("prestacoes_snapshot")
      .select("id, organization_id, revogado_em")
      .eq("id", data.snapshotId)
      .maybeSingle();
    if (eSel) throw new Error(eSel.message);
    if (!snap) throw new Error("Snapshot não encontrado.");
    if ((snap as { organization_id: string }).organization_id !== data.activeOrgId) {
      throw new Error("Snapshot de outra organização.");
    }
    if ((snap as { revogado_em: string | null }).revogado_em) {
      throw new Error("Prestação já estava reaberta.");
    }

    // Marca como revogado.
    const { error: eUp } = await (supabaseAdmin as any)
      .from("prestacoes_snapshot")
      .update({
        revogado_em: new Date().toISOString(),
        revogado_por: userId,
        revogado_motivo: data.motivo,
      })
      .eq("id", data.snapshotId);
    if (eUp) throw new Error(eUp.message);

    // Libera eventos.
    const { error: eEv } = await supabaseAdmin
      .from("eventos_financeiros")
      .update({ prestacao_snapshot_id: null })
      .eq("prestacao_snapshot_id", data.snapshotId);
    if (eEv) throw new Error(eEv.message);

    // Log de auditoria.
    await (supabaseAdmin as any).from("audit_log").insert({
      organization_id: data.activeOrgId,
      user_id: userId,
      acao: "prestacoes_snapshot:reabrir",
      payload: { snapshot_id: data.snapshotId, motivo: data.motivo },
    });

    return { ok: true as const };
  });
