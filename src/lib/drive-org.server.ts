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
  // 1) Atalho via banco: se o file id já está registrado como anexo ou
  // documento da prestação da org, autoriza sem consultar o Drive.
  const [anx, prd] = await Promise.all([
    supabaseAdmin
      .from("documentos_anexos")
      .select("id")
      .eq("organization_id", orgId)
      .eq("drive_file_id", fileId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("prestacao_documentos")
      .select("id")
      .eq("organization_id", orgId)
      .eq("drive_file_id", fileId)
      .limit(1)
      .maybeSingle(),
  ]);
  if (anx.data || prd.data) return true;

  // 2) Walk BFS pela árvore de pastas do Drive.
  const { data } = await supabaseAdmin
    .from("organization_drive_folders")
    .select("root_folder_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data?.root_folder_id) return false;
  const orgRoot = data.root_folder_id;

  const queue: string[] = [fileId];
  const seen = new Set<string>();
  let checks = 0;
  while (queue.length && checks < 40) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current === orgRoot) return true;
    checks++;
    const res = await fetch(`${DRIVE}/files/${current}?fields=id,parents&supportsAllDrives=true`, {
      headers: driveHeaders(),
    });
    if (!res.ok) continue;
    const meta = await res.json();
    const parents: string[] = meta.parents ?? [];
    if (parents.includes(orgRoot)) return true;
    for (const p of parents) if (!seen.has(p)) queue.push(p);
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

/** Lista recursiva: arquivos direto na pasta + arquivos nas subpastas mês (AAAA-MM).
 *  Retorna também a origem (`section`) e o mês inferido pelo nome da subpasta. */
export async function listSectionFilesRecursive(args: {
  folderId: string;
  section: string;
}): Promise<Array<DriveFileEntry & { section: string; mes?: string }>> {
  const direct = await listOrgFolderFiles({ folderId: args.folderId });
  const out: Array<DriveFileEntry & { section: string; mes?: string }> = [];
  const subFolders: Array<{ id: string; mes?: string }> = [];
  for (const f of direct) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      const mes = /^\d{4}-\d{2}$/.test(f.name) ? f.name : undefined;
      subFolders.push({ id: f.id, mes });
    } else {
      out.push({ ...f, section: args.section });
    }
  }
  // Busca em paralelo em cada subpasta mês; não desce mais um nível.
  await Promise.all(
    subFolders.map(async (sf) => {
      const files = await listOrgFolderFiles({ folderId: sf.id }).catch(() => []);
      for (const f of files) {
        if (f.mimeType === "application/vnd.google-apps.folder") continue;
        out.push({ ...f, section: args.section, mes: sf.mes });
      }
    }),
  );
  return out;
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
