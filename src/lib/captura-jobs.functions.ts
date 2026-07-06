/**
 * Server functions do fluxo assíncrono de captura.
 * O processamento real vive em `captura-processor.server.ts` (service role),
 * mas nunca é importado aqui — é acionado via HTTP no endpoint público
 * `/api/public/hooks/captura-worker`, com um dispatch de fetch pelo próprio
 * cliente (keepalive) e um cron de backup a cada minuto.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EnfileirarSchema = z.object({
  storagePath: z.string().min(1).max(500),
  hash: z.string().length(64),
  nomeArquivo: z.string().min(1).max(255),
  mimeType: z.string().max(100).nullable().optional(),
  tamanhoBytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
  mesReferencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  organizationId: z.string().uuid(),
});

export const enfileirarCaptura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnfileirarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ jobId: string }> => {
    const { supabase, userId } = context;
    const ins = await supabase
      .from("captura_jobs")
      .insert({
        organization_id: data.organizationId,
        criado_por: userId,
        storage_path: data.storagePath,
        arquivo_hash: data.hash,
        nome_arquivo: data.nomeArquivo,
        mime_type: data.mimeType ?? null,
        tamanho_bytes: data.tamanhoBytes,
        mes_referencia: data.mesReferencia,
        status: "pendente",
        mensagem: "aguardando processamento",
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return { jobId: ins.data.id };
  });

const ListarSchema = z.object({
  organizationId: z.string().uuid(),
  mesReferencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  limite: z.number().int().min(1).max(200).default(50),
});

export const listarCapturaJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("captura_jobs")
      .select("id, status, mensagem, storage_path, arquivo_hash, nome_arquivo, mime_type, tamanho_bytes, mes_referencia, evento_id, documento_id, dados, criado_em, atualizado_em, tentativas")
      .eq("organization_id", data.organizationId)
      .order("criado_em", { ascending: false })
      .limit(data.limite);
    if (data.mesReferencia) q = q.eq("mes_referencia", data.mesReferencia);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { jobs: rows ?? [] };
  });

const JobIdSchema = z.object({ jobId: z.string().uuid() });

export const reprocessarCapturaJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("captura_jobs")
      .update({
        status: "pendente",
        mensagem: "reagendado para reprocessamento",
        iniciado_em: null,
        finalizado_em: null,
      })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removerCapturaJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("captura_jobs").delete().eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
