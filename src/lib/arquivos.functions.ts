import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ensureOrgFolders,
  ensureMesFolder,
  listOrgFolderFiles,
  fetchStorageQuota,
  SUBFOLDERS,
  type SubfolderName,
} from "./drive-org.server";

async function orgId(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_org");
  if (error || !data) throw new Error("Organização ativa não encontrada");
  return data as string;
}

export const listarArquivosDaOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      section: z.enum(SUBFOLDERS as unknown as [SubfolderName, ...SubfolderName[]]).optional(),
      mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const folders = await ensureOrgFolders(id);
    let target: string;
    if (data.section && data.mes) {
      target = await ensureMesFolder(id, data.section, data.mes);
    } else if (data.section) {
      target = folders.subfolders[data.section];
    } else {
      target = folders.rootFolderId;
    }
    const files = await listOrgFolderFiles({ folderId: target });
    return { folderId: target, files };
  });

export const garantirEstruturaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const id = await orgId(context.supabase);
    return ensureOrgFolders(id);
  });

export const getDriveQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => fetchStorageQuota());

/** Estatísticas da fila de sincronização Drive para a org ativa. */
export const getDriveSyncStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: orgId } = await supabase.rpc("current_user_org");
    if (!orgId) return { pendente: 0, falhou_retry: 0, falhou_definitivo: 0, ultimoErro: null as string | null };
    const { data, error } = await (supabase as any)
      .from("drive_sync_queue")
      .select("status, ultimo_erro")
      .eq("organization_id", orgId)
      .in("status", ["pendente", "em_andamento", "falhou_retry", "falhou_definitivo"])
      .order("atualizado_em", { ascending: false })
      .limit(500);
    if (error) return { pendente: 0, falhou_retry: 0, falhou_definitivo: 0, ultimoErro: null };
    const rows = (data ?? []) as Array<{ status: string; ultimo_erro: string | null }>;
    let pendente = 0, falhou_retry = 0, falhou_definitivo = 0, ultimoErro: string | null = null;
    for (const r of rows) {
      if (r.status === "pendente" || r.status === "em_andamento") pendente++;
      else if (r.status === "falhou_retry") { falhou_retry++; if (!ultimoErro) ultimoErro = r.ultimo_erro; }
      else if (r.status === "falhou_definitivo") { falhou_definitivo++; if (!ultimoErro) ultimoErro = r.ultimo_erro; }
    }
    return { pendente, falhou_retry, falhou_definitivo, ultimoErro };
  });
