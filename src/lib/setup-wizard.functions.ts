/**
 * Wizard de configuração inicial — Drive, Docs, Sheets via gateway.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3";
const DOCS = "https://connector-gateway.lovable.dev/google_docs/v1";
const SHEETS = "https://connector-gateway.lovable.dev/google_sheets/v4";

function driveHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const k = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!k) throw new Error("Conector do Google Drive não está vinculado. Vá em Configurações → Conectores.");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": k };
}
function docsHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const k = process.env.GOOGLE_DOCS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!k) throw new Error("Conector do Google Docs não está vinculado. Vá em Configurações → Conectores.");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": k };
}
function sheetsHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const k = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!k) throw new Error("Conector do Google Sheets não está vinculado. Vá em Configurações → Conectores.");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": k };
}

export function extrairDriveId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // padrão simples (só o id)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  // /folders/<id> ou /file/d/<id>/ ou /document/d/<id>/ ou /spreadsheets/d/<id>/
  const m =
    s.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
    s.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

export const validarPastaDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const id = extrairDriveId(data.url);
    if (!id) throw new Error("Link inválido. Cole a URL completa da pasta no Google Drive.");
    const res = await fetch(`${DRIVE}/files/${id}?fields=id,name,mimeType,webViewLink`, {
      headers: driveHeaders(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Não consegui ler a pasta (${res.status}). Verifique se a conta conectada tem acesso. Detalhe: ${body.slice(0, 200)}`);
    }
    const j = (await res.json()) as { id: string; name: string; mimeType: string; webViewLink?: string };
    if (j.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("Esse link não é uma pasta. Cole o link de uma pasta do Drive (URL com /folders/).");
    }
    return { id: j.id, name: j.name, link: j.webViewLink };
  });

export const criarSubpastas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        parentId: z.string().min(5).max(100),
        nomes: z.array(z.string().min(1).max(80)).min(1).max(20),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    // tenta ler subpastas existentes pra não duplicar
    const q = encodeURIComponent(`'${data.parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const existRes = await fetch(`${DRIVE}/files?q=${q}&fields=files(id,name)&pageSize=1000`, {
      headers: driveHeaders(),
    });
    if (!existRes.ok) {
      const body = await existRes.text();
      throw new Error(`Falha ao listar pasta raiz (${existRes.status}): ${body.slice(0, 200)}`);
    }
    const existing = ((await existRes.json()) as { files: Array<{ id: string; name: string }> }).files ?? [];
    const map: Record<string, { id: string; name: string; created: boolean }> = {};
    for (const nome of data.nomes) {
      const found = existing.find((f) => f.name.toLowerCase() === nome.toLowerCase());
      if (found) {
        map[nome] = { id: found.id, name: found.name, created: false };
        continue;
      }
      const createRes = await fetch(`${DRIVE}/files?fields=id,name`, {
        method: "POST",
        headers: { ...driveHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          mimeType: "application/vnd.google-apps.folder",
          parents: [data.parentId],
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.text();
        throw new Error(`Falha ao criar subpasta "${nome}" (${createRes.status}): ${body.slice(0, 200)}`);
      }
      const j = (await createRes.json()) as { id: string; name: string };
      map[nome] = { id: j.id, name: j.name, created: true };
    }
    return map;
  });

export const validarDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const id = extrairDriveId(data.url);
    if (!id) throw new Error("Link inválido. Cole a URL completa do Google Docs.");
    const res = await fetch(`${DOCS}/documents/${id}?fields=documentId,title`, { headers: docsHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Não consegui abrir o documento (${res.status}). Verifique acesso. Detalhe: ${body.slice(0, 200)}`);
    }
    const j = (await res.json()) as { documentId: string; title: string };
    return { id: j.documentId, name: j.title };
  });

export const validarSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const id = extrairDriveId(data.url);
    if (!id) throw new Error("Link inválido. Cole a URL completa do Google Sheets.");
    const res = await fetch(
      `${SHEETS}/spreadsheets/${id}?fields=spreadsheetId,properties.title,sheets.properties.title`,
      { headers: sheetsHeaders() }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Não consegui abrir a planilha (${res.status}). Verifique acesso. Detalhe: ${body.slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      spreadsheetId: string;
      properties: { title: string };
      sheets: Array<{ properties: { title: string } }>;
    };
    return {
      id: j.spreadsheetId,
      name: j.properties.title,
      abas: j.sheets.map((s) => s.properties.title),
    };
  });
