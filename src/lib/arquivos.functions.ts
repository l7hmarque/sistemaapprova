import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ensureOrgFolders,
  ensureMesFolder,
  listOrgFolderFiles,
  listSectionFilesRecursive,
  fetchStorageQuota,
  trashDriveFile,
  SUBFOLDERS,
  type SubfolderName,
} from "./drive-org.server";


async function orgId(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_org");
  if (error || !data) throw new Error("Organização ativa não encontrada");
  return data as string;
}

export interface ArquivoListado {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  section?: string;
  mes?: string;
  linkedEventoInterno?: string | null;
  linkedPrestacao?: boolean;
}

export const listarArquivosDaOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      // "todas" (padrão) lista as 4 subpastas + subpastas de mês agregadas
      section: z
        .union([z.literal("todas"), z.enum(SUBFOLDERS as unknown as [SubfolderName, ...SubfolderName[]])])
        .optional(),
      mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const folders = await ensureOrgFolders(id);

    let files: ArquivoListado[];
    let folderId: string;

    if (!data.section || data.section === "todas") {
      folderId = folders.rootFolderId;
      const grouped = await Promise.all(
        SUBFOLDERS.map((s) =>
          listSectionFilesRecursive({ folderId: folders.subfolders[s], section: s }),
        ),
      );
      files = grouped.flat();
      // ordena por data desc
      files.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1));
      // aplica filtro de mês, se veio
      if (data.mes) files = files.filter((f) => f.mes === data.mes);
    } else if (data.mes) {
      folderId = await ensureMesFolder(id, data.section, data.mes);
      const raw = await listOrgFolderFiles({ folderId });
      files = raw.map((f) => ({ ...f, section: data.section, mes: data.mes }));
    } else {
      folderId = folders.subfolders[data.section];
      const raw = await listSectionFilesRecursive({
        folderId: folders.subfolders[data.section],
        section: data.section,
      });
      files = raw;
    }

    // Enriquecimento: identifica arquivos vinculados a eventos/prestação
    const ids = files.map((f) => f.id);
    if (ids.length) {
      const [{ data: anx }, { data: prd }] = await Promise.all([
        (context.supabase as any)
          .from("documentos_anexos")
          .select("drive_file_id, evento_id")
          .in("drive_file_id", ids)
          .eq("organization_id", id),
        (context.supabase as any)
          .from("prestacao_documentos")
          .select("drive_file_id")
          .in("drive_file_id", ids)
          .eq("organization_id", id),
      ]);
      const anxByFile = new Map<string, string>(); // drive_file_id -> evento_id
      for (const row of (anx ?? []) as any[]) {
        if (row.drive_file_id && row.evento_id) anxByFile.set(row.drive_file_id, row.evento_id);
      }
      const prdSet = new Set<string>(
        (prd ?? []).map((r: any) => r.drive_file_id).filter(Boolean),
      );
      const eventoIds = Array.from(new Set(anxByFile.values()));
      let idInternoByEvento = new Map<string, string>();
      if (eventoIds.length) {
        const { data: evs } = await (context.supabase as any)
          .from("eventos_financeiros")
          .select("id, id_interno")
          .in("id", eventoIds);
        for (const e of (evs ?? []) as any[]) {
          idInternoByEvento.set(e.id, e.id_interno ?? "");
        }
      }
      files = files.map((f) => ({
        ...f,
        linkedEventoInterno: anxByFile.get(f.id)
          ? idInternoByEvento.get(anxByFile.get(f.id)!) ?? null
          : undefined,
        linkedPrestacao: prdSet.has(f.id) || undefined,
      }));
    }

    return { folderId, files };
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
