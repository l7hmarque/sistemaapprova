/**
 * Multi-tenant Drive: each organization has its own folder tree under
 * a master "Approva/" root in the workspace Google Drive account.
 *
 * NEVER import this file from the client.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

export const SUBFOLDERS = ["Orçamentos", "Cotações", "Prestações", "Documentos"] as const;
export type SubfolderName = (typeof SUBFOLDERS)[number];

function driveHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const drv = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!drv) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte o Google Drive");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": drv };
}

async function jsonOrThrow(res: Response, ctx: string): Promise<any> {
  const txt = await res.text();
  if (!res.ok) throw new Error(`${ctx} falhou [${res.status}]: ${txt.slice(0, 400)}`);
  try { return JSON.parse(txt); } catch { return {}; }
}

async function findFolder(name: string, parent?: string): Promise<string | null> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name.replace(/'/g, "\\'")}'` +
      (parent ? ` and '${parent}' in parents` : ""),
  );
  const res = await fetch(`${DRIVE}/files?q=${q}&fields=files(id,name)&pageSize=10`, {
    headers: driveHeaders(),
  });
  const data = await jsonOrThrow(res, "drive.files.list");
  return (data.files ?? [])[0]?.id ?? null;
}

async function createFolder(name: string, parent?: string): Promise<string> {
  const res = await fetch(`${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: { ...driveHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parent ? [parent] : undefined,
    }),
  });
  const data = await jsonOrThrow(res, "drive.files.create(folder)");
  return data.id as string;
}

async function ensureFolder(name: string, parent?: string): Promise<string> {
  const found = await findFolder(name, parent);
  if (found) return found;
  return createFolder(name, parent);
}

export interface OrgFolders {
  rootFolderId: string;
  subfolders: Record<SubfolderName, string>;
}

/** Idempotente: garante Approva/{orgId}/{subpastas} no Drive da conta master. */
export async function ensureOrgFolders(orgId: string): Promise<OrgFolders> {
  const { data: existing } = await supabaseAdmin
    .from("organization_drive_folders")
    .select("root_folder_id, subfolders")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing?.root_folder_id) {
    const subs = (existing.subfolders ?? {}) as Record<string, string>;
    const allOk = SUBFOLDERS.every((n) => typeof subs[n] === "string" && subs[n]);
    if (allOk) {
      return {
        rootFolderId: existing.root_folder_id,
        subfolders: subs as Record<SubfolderName, string>,
      };
    }
  }

  const approvaRoot = await ensureFolder("Approva");
  const orgRoot = await ensureFolder(orgId, approvaRoot);
  const subs: Record<string, string> = {};
  for (const name of SUBFOLDERS) {
    subs[name] = await ensureFolder(name, orgRoot);
  }

  await supabaseAdmin
    .from("organization_drive_folders")
    .upsert(
      { organization_id: orgId, root_folder_id: orgRoot, subfolders: subs },
      { onConflict: "organization_id" },
    );

  return { rootFolderId: orgRoot, subfolders: subs as Record<SubfolderName, string> };
}

/** Subpasta por mês dentro de uma seção (ex.: Orçamentos/2025-06). */
export async function ensureMesFolder(
  orgId: string,
  section: SubfolderName,
  mesRef?: string | null,
): Promise<string> {
  const folders = await ensureOrgFolders(orgId);
  const parent = folders.subfolders[section];
  const mes = mesRef && /^\d{4}-\d{2}$/.test(mesRef) ? mesRef : new Date().toISOString().slice(0, 7);
  return ensureFolder(mes, parent);
}

/** Garante que fileId pertença (transitivamente) à pasta raiz da org. Para o proxy de preview. */
export async function fileBelongsToOrg(orgId: string, fileId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("organization_drive_folders")
    .select("root_folder_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data?.root_folder_id) return false;
  const orgRoot = data.root_folder_id;

  let current: string | null = fileId;
  const seen = new Set<string>();
  for (let i = 0; i < 8 && current; i++) {
    if (seen.has(current)) break;
    seen.add(current);
    const res = await fetch(`${DRIVE}/files/${current}?fields=id,parents&supportsAllDrives=true`, {
      headers: driveHeaders(),
    });
    if (!res.ok) return false;
    const meta = await res.json();
    const parents: string[] = meta.parents ?? [];
    if (parents.includes(orgRoot)) return true;
    current = parents[0] ?? null;
  }
  return false;
}

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

export async function listOrgFolderFiles(args: {
  folderId: string;
  pageSize?: number;
}): Promise<DriveFileEntry[]> {
  const q = encodeURIComponent(`'${args.folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,size)");
  const res = await fetch(
    `${DRIVE}/files?q=${q}&fields=${fields}&pageSize=${args.pageSize ?? 100}&orderBy=modifiedTime%20desc`,
    { headers: driveHeaders() },
  );
  const data = await jsonOrThrow(res, "drive.files.list");
  return data.files ?? [];
}

/** Stream binário do arquivo (proxy de preview). */
export async function fetchDriveFileMedia(fileId: string): Promise<Response> {
  const metaRes = await fetch(`${DRIVE}/files/${fileId}?fields=mimeType,name&supportsAllDrives=true`, {
    headers: driveHeaders(),
  });
  const meta = await jsonOrThrow(metaRes, "drive.files.get");
  const mt: string = meta.mimeType ?? "";
  const isGoogleNative = mt.startsWith("application/vnd.google-apps.");

  if (isGoogleNative) {
    const r = await fetch(
      `${DRIVE}/files/${fileId}/export?mimeType=${encodeURIComponent("application/pdf")}`,
      { headers: driveHeaders() },
    );
    return r;
  }

  const r = await fetch(`${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: driveHeaders(),
  });
  return r;
}

export async function fetchStorageQuota(): Promise<{ limit: number; usage: number } | null> {
  const res = await fetch(
    `https://connector-gateway.lovable.dev/google_drive/drive/v3/about?fields=storageQuota`,
    { headers: driveHeaders() },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const q = data.storageQuota;
  if (!q) return null;
  return { limit: Number(q.limit ?? 0), usage: Number(q.usage ?? 0) };
}
