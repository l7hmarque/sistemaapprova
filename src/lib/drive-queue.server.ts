/**
 * Fila assíncrona de sincronização Storage → Drive.
 *
 * Fluxo:
 *  - `enqueueDriveSync` é chamado por server functions logo APÓS o upload
 *    bem-sucedido no Supabase Storage. A resposta ao usuário não espera o Drive.
 *  - `processDriveQueueTick` é invocado pelo cron via `/api/public/hooks/drive-sync-tick`.
 *    Ele reserva jobs atomicamente (RPC `drive_queue_claim`), processa cada um,
 *    e agenda retry exponencial em caso de falha.
 *
 * Nunca importar este arquivo do cliente. Só server functions/routes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureMesFolder, type SubfolderName } from "./drive-org.server";

const DRIVE_UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files";

const RETRY_STEPS_SEC = [30, 120, 600, 3600, 21600]; // 30s, 2min, 10min, 1h, 6h
const MAX_TENTATIVAS = RETRY_STEPS_SEC.length;

function driveHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const drv = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!drv) throw new Error("GOOGLE_DRIVE_API_KEY ausente");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": drv };
}

export interface EnqueueArgs {
  organizationId: string;
  bucket: "documentos" | "prestacoes";
  path: string;
  section: SubfolderName;
  mesRef?: string | null;
  refTable?: string | null;
  refId?: string | null;
  nomeOriginal?: string | null;
  mimeType?: string | null;
}

/**
 * Insere job na fila. Falhas aqui NÃO devem quebrar o request do usuário
 * (upload no Storage já foi feito) — logamos e seguimos.
 */
export async function enqueueDriveSync(args: EnqueueArgs): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from("drive_sync_queue")
      .insert({
        organization_id: args.organizationId,
        bucket: args.bucket,
        path: args.path,
        section: args.section,
        mes_ref: args.mesRef ?? null,
        ref_table: args.refTable ?? null,
        ref_id: args.refId ?? null,
        nome_original: args.nomeOriginal ?? null,
        mime_type: args.mimeType ?? null,
        status: "pendente",
      });
    if (error) console.warn("[drive-queue] enqueue falhou:", error.message);
  } catch (e) {
    console.warn("[drive-queue] enqueue exception:", e);
  }
}

interface Job {
  id: string;
  organization_id: string;
  bucket: string;
  path: string;
  section: SubfolderName;
  mes_ref: string | null;
  ref_table: string | null;
  ref_id: string | null;
  nome_original: string | null;
  mime_type: string | null;
  tentativas: number;
}

async function uploadToDrive(job: Job): Promise<string> {
  // 1. Baixa do Storage
  const dl = await (supabaseAdmin as any).storage.from(job.bucket).download(job.path);
  if (dl.error || !dl.data) throw new Error(`storage.download: ${dl.error?.message ?? "vazio"}`);
  const blob: Blob = dl.data;
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // 2. Garante pasta da org/mês/seção
  const parentId = await ensureMesFolder(job.organization_id, job.section, job.mes_ref);
  const nome = job.nome_original ?? job.path.split("/").pop() ?? "arquivo";
  const mime = job.mime_type ?? "application/octet-stream";

  // 3. Upload multipart no Drive
  const boundary = `----boundary-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: nome, parents: [parentId], mimeType: mime });
  const enc = new TextEncoder();
  const header = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const footer = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(header.length + bytes.length + footer.length);
  body.set(header, 0);
  body.set(bytes, header.length);
  body.set(footer, header.length + bytes.length);

  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: { ...driveHeaders(), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`drive.upload [${res.status}]: ${txt.slice(0, 300)}`);
  const data = JSON.parse(txt);
  const fileId = data.id as string;
  if (!fileId) throw new Error(`drive.upload sem id: ${txt.slice(0, 200)}`);
  return fileId;
}

async function markSuccess(job: Job, driveFileId: string): Promise<void> {
  await (supabaseAdmin as any)
    .from("drive_sync_queue")
    .update({ status: "sincronizado", drive_file_id: driveFileId, ultimo_erro: null })
    .eq("id", job.id);

  // Propaga drive_file_id na tabela referenciada, quando aplicável.
  if (job.ref_table && job.ref_id) {
    try {
      await (supabaseAdmin as any)
        .from(job.ref_table)
        .update({ drive_file_id: driveFileId })
        .eq("id", job.ref_id);
    } catch (e) {
      console.warn("[drive-queue] propagar drive_file_id falhou:", e);
    }
  }
}

async function markFailure(job: Job, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  const proxima = job.tentativas >= MAX_TENTATIVAS ? null : RETRY_STEPS_SEC[job.tentativas - 1] ?? RETRY_STEPS_SEC[0];
  const nextStatus = proxima == null ? "falhou_definitivo" : "falhou_retry";
  const payload: Record<string, unknown> = { status: nextStatus, ultimo_erro: msg.slice(0, 500) };
  if (proxima != null) {
    payload.proximo_retry = new Date(Date.now() + proxima * 1000).toISOString();
  }
  await (supabaseAdmin as any).from("drive_sync_queue").update(payload).eq("id", job.id);
}

export interface TickResult {
  claimed: number;
  ok: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export async function processDriveQueueTick(limit = 5): Promise<TickResult> {
  const claim = await (supabaseAdmin as any).rpc("drive_queue_claim", { _limit: limit });
  if (claim.error) throw new Error(`claim: ${claim.error.message}`);
  const jobs: Job[] = (claim.data ?? []) as Job[];
  const result: TickResult = { claimed: jobs.length, ok: 0, failed: 0, errors: [] };
  for (const job of jobs) {
    try {
      const fileId = await uploadToDrive(job);
      await markSuccess(job, fileId);
      result.ok++;
    } catch (e) {
      await markFailure(job, e);
      result.failed++;
      result.errors.push({ id: job.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
