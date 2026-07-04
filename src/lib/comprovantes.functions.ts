import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "documentos";

async function enqueueDriveSyncSafe(args: {
  organizationId: string;
  path: string;
  section: "Documentos" | "Orçamentos" | "Cotações" | "Prestações";
  mesRef?: string | null;
  refTable?: string | null;
  refId?: string | null;
  nomeOriginal?: string | null;
  mimeType?: string | null;
}): Promise<void> {
  try {
    const { enqueueDriveSync } = await import("@/lib/drive-queue.server");
    await enqueueDriveSync({ ...args, bucket: "documentos" });
  } catch (e) {
    console.warn("[comprovantes] enqueue Drive falhou:", e);
  }
}

export type ComprovanteResumo = {
  id: string;
  despesa_uid: string;
  nome: string;
  arquivo_url: string | null;
  status_aprovacao: "pendente" | "aprovado" | "rejeitado";
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao_aprovacao: string | null;
  criado_em: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  // ownership marker — quem fez upload (necessário p/ regra de quatro olhos)
  uploaded_by_self: boolean;
};

export const listarComprovantes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ extracaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Record<string, ComprovanteResumo[]>> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("prestacao_documentos")
      .select("id, despesa_uid, nome, arquivo_url, status_aprovacao, aprovado_por, aprovado_em, observacao_aprovacao, criado_em, tamanho_bytes, mime_type, descricao")
      .eq("extracao_id", data.extracaoId)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);

    const out: Record<string, ComprovanteResumo[]> = {};
    for (const r of rows ?? []) {
      const uid = r.despesa_uid ?? "";
      if (!uid) continue;
      const uploaderId = (r as { descricao?: string | null }).descricao ?? null;
      const item: ComprovanteResumo = {
        id: r.id,
        despesa_uid: uid,
        nome: r.nome,
        arquivo_url: r.arquivo_url,
        status_aprovacao: (r.status_aprovacao ?? "pendente") as ComprovanteResumo["status_aprovacao"],
        aprovado_por: r.aprovado_por,
        aprovado_em: r.aprovado_em,
        observacao_aprovacao: r.observacao_aprovacao,
        criado_em: r.criado_em,
        tamanho_bytes: r.tamanho_bytes,
        mime_type: r.mime_type,
        uploaded_by_self: uploaderId === userId,
      };
      (out[uid] ??= []).push(item);
    }
    return out;
  });

export const anexarComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        extracaoId: z.string().uuid(),
        despesaUid: z.string().min(1).max(60),
        nome: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(120),
        // base64 do arquivo (data url ou puro)
        conteudoBase64: z.string().min(8).max(20_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const b64 = data.conteudoBase64.includes(",")
      ? data.conteudoBase64.split(",")[1]
      : data.conteudoBase64;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 15 * 1024 * 1024) {
      throw new Error("Comprovante acima de 15 MB.");
    }
    // hash curto para evitar colisão no path
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(hash))
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const ext = (data.nome.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
    const path = `comprovantes/${data.extracaoId}/${data.despesaUid}-${hex}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.mimeType, upsert: true });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

    const { data: ins, error: insErr } = await supabase
      .from("prestacao_documentos")
      .insert({
        nome: data.nome,
        descricao: userId, // usamos descricao p/ guardar quem fez upload (sem coluna nova)
        ordem: 0,
        extracao_id: data.extracaoId,
        despesa_uid: data.despesaUid,
        arquivo_url: path,
        mime_type: data.mimeType,
        tamanho_bytes: bytes.byteLength,
        status_aprovacao: "pendente",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Enfileira sincronização para o Google Drive master (não bloqueia a resposta).
    const { data: orgId } = await supabase.rpc("current_user_org");
    if (orgId) {
      const mesRef = new Date().toISOString().slice(0, 7);
      await enqueueDriveSyncSafe({
        organizationId: orgId as string,
        path,
        section: "Documentos",
        mesRef,
        refTable: "prestacao_documentos",
        refId: ins.id,
        nomeOriginal: data.nome,
        mimeType: data.mimeType,
      });
    }
    return { ok: true as const, id: ins.id, path };
  });

export const removerComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: selErr } = await supabase
      .from("prestacao_documentos")
      .select("arquivo_url")
      .eq("id", data.id)
      .single();
    if (selErr) throw new Error(selErr.message);
    if (row?.arquivo_url) {
      await supabase.storage.from(BUCKET).remove([row.arquivo_url]);
    }
    const { error: delErr } = await supabase
      .from("prestacao_documentos")
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true as const };
  });

export const linkComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Falha gerando link");
    return { url: signed.signedUrl };
  });

export const aprovarComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aprovado", "rejeitado", "pendente"]),
        observacao: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Regra de quatro olhos: quem aprova ≠ quem fez upload (guardado em descricao).
    const { data: row, error: selErr } = await supabase
      .from("prestacao_documentos")
      .select("descricao")
      .eq("id", data.id)
      .single();
    if (selErr) throw new Error(selErr.message);
    if (data.status !== "pendente" && row?.descricao === userId) {
      throw new Error("Quem lançou não pode aprovar o próprio comprovante.");
    }
    const { error } = await supabase
      .from("prestacao_documentos")
      .update({
        status_aprovacao: data.status,
        aprovado_por: data.status === "pendente" ? null : userId,
        aprovado_em: data.status === "pendente" ? null : new Date().toISOString(),
        observacao_aprovacao: data.observacao ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listarPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("prestacao_documentos")
      .select("id, nome, despesa_uid, extracao_id, criado_em, mime_type, tamanho_bytes, descricao, arquivo_url")
      .eq("organization_id", data.organization_id)
      .eq("status_aprovacao", "pendente")
      .not("extracao_id", "is", null)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { pendentes: rows ?? [] };
  });
