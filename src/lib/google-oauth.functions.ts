/**
 * OAuth Google por OSC — fluxo "Connect Drive" do wizard de configuração.
 *
 * Cada organização autoriza o Approva a acessar seu Drive próprio.
 * Guardamos o connectionAPIKey (lovack_*) em public.google_connections.
 * Depois usamos callAsAppUser() para criar a pasta raiz e subpastas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  callAsAppUser,
} from "@/integrations/lovable/appUserConnector";

const GATEWAY = "https://connector-gateway.lovable.dev";
const SUBPASTAS = ["Orçamentos", "Cotações", "Prestações", "Documentos"];

function requireClientId(): string {
  const id = process.env.GOOGLE_APP_USER_CONNECTOR_CLIENT_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_APP_USER_CONNECTOR_CLIENT_ID não configurado. Cadastre em Configurações → Secrets.",
    );
  }
  return id;
}

async function currentOrgId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.organization_id) throw new Error("Usuário sem organização.");
  return data.organization_id as string;
}

/** Inicia o OAuth Google da OSC. Retorna authorization_url para o popup. */
export const startGoogleDriveOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetOrigin: z.string().url(),
        returnUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { authorizationUrl, sessionId } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY,
      connectorId: "google",
      appUserId: userId,
      connectorClientId: requireClientId(),
      returnUrl: data.returnUrl,
      responseMode: "web_message",
      webMessageTargetOrigin: data.targetOrigin,
      credentialsConfiguration: {
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "openid",
        ],
      },
    });
    return { authorizationUrl, sessionId };
  });

/** Salva a credencial OAuth contra a organização atual. */
export const saveGoogleConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ connectionAPIKey: z.string().min(8).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await currentOrgId(supabase, userId);

    // descobre o e-mail do Google
    let googleEmail: string | null = null;
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY,
        connectionAPIKey: data.connectionAPIKey,
        connectorId: "google",
        path: "/oauth2/v2/userinfo",
      });
      if (res.ok) {
        const j = (await res.json()) as { email?: string };
        googleEmail = j.email ?? null;
      }
    } catch {
      /* não bloqueia o salvamento */
    }

    const { error } = await supabase
      .from("google_connections")
      .upsert(
        {
          organization_id: orgId,
          connection_api_key: data.connectionAPIKey,
          google_email: googleEmail,
          connected_by: userId,
        },
        { onConflict: "organization_id" },
      );
    if (error) throw new Error("Falha ao salvar conexão: " + error.message);
    return { ok: true, googleEmail };
  });

/** Lê a conexão da org atual. */
export const getGoogleConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await currentOrgId(supabase, userId);
    const { data } = await supabase
      .from("google_connections")
      .select("google_email, criado_em, atualizado_em")
      .eq("organization_id", orgId)
      .maybeSingle();
    return data
      ? { connected: true, googleEmail: data.google_email, since: data.criado_em }
      : { connected: false };
  });

/** Remove a conexão da org atual. */
export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await currentOrgId(supabase, userId);
    const { error } = await supabase
      .from("google_connections")
      .delete()
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Cria a estrutura "Approva/{subpastas}" na conta Google da OSC.
 * Idempotente: se a pasta já existe (mesmo nome no root do Drive), reutiliza.
 */
export const setupDriveStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rootName: z.string().min(1).max(80).default("Approva") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await currentOrgId(supabase, userId);

    const { data: conn, error: connErr } = await supabase
      .from("google_connections")
      .select("connection_api_key")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!conn?.connection_api_key) {
      throw new Error("Conta Google não conectada. Volte e clique em 'Conectar Google Drive'.");
    }
    const apiKey = conn.connection_api_key as string;

    async function gcall(path: string, init?: RequestInit) {
      return callAsAppUser({
        gatewayBaseUrl: GATEWAY,
        connectionAPIKey: apiKey,
        connectorId: "google_drive",
        path,
        init,
      });
    }

    // 1) procurar pasta raiz já existente
    const qRoot = encodeURIComponent(
      `name='${data.rootName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    );
    const findRes = await gcall(`/drive/v3/files?q=${qRoot}&fields=files(id,name,webViewLink)`);
    if (!findRes.ok) {
      const t = await findRes.text();
      throw new Error(`Erro ao consultar Drive (${findRes.status}): ${t.slice(0, 200)}`);
    }
    const findJson = (await findRes.json()) as { files?: Array<{ id: string; name: string; webViewLink?: string }> };
    let root = findJson.files?.[0];

    if (!root) {
      const createRes = await gcall(`/drive/v3/files?fields=id,name,webViewLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.rootName,
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      if (!createRes.ok) {
        const t = await createRes.text();
        throw new Error(`Erro ao criar pasta raiz (${createRes.status}): ${t.slice(0, 200)}`);
      }
      root = (await createRes.json()) as { id: string; name: string; webViewLink?: string };
    }

    // 2) listar subpastas existentes
    const qSubs = encodeURIComponent(
      `'${root.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const subsRes = await gcall(`/drive/v3/files?q=${qSubs}&fields=files(id,name)&pageSize=1000`);
    if (!subsRes.ok) {
      const t = await subsRes.text();
      throw new Error(`Erro ao listar subpastas (${subsRes.status}): ${t.slice(0, 200)}`);
    }
    const existing = ((await subsRes.json()) as { files: Array<{ id: string; name: string }> }).files ?? [];

    const subs: Record<string, { id: string; name: string; created: boolean }> = {};
    for (const nome of SUBPASTAS) {
      const found = existing.find((f) => f.name.toLowerCase() === nome.toLowerCase());
      if (found) {
        subs[nome] = { id: found.id, name: found.name, created: false };
        continue;
      }
      const cRes = await gcall(`/drive/v3/files?fields=id,name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          mimeType: "application/vnd.google-apps.folder",
          parents: [root.id],
        }),
      });
      if (!cRes.ok) {
        const t = await cRes.text();
        throw new Error(`Erro ao criar "${nome}" (${cRes.status}): ${t.slice(0, 200)}`);
      }
      const j = (await cRes.json()) as { id: string; name: string };
      subs[nome] = { id: j.id, name: j.name, created: true };
    }

    const valor = {
      root: { id: root.id, name: root.name, link: root.webViewLink },
      subs,
    };

    // salva em configuracoes (mesmo schema do wizard antigo, para reaproveitamento)
    await supabase
      .from("configuracoes")
      .upsert({ chave: "wizard_drive_setup", valor }, { onConflict: "chave" });

    return valor;
  });
