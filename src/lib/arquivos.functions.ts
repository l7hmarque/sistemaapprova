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
