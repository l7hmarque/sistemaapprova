/**
 * Proxy autenticado do PDF de Prestação de Contas.
 * Serve o bytes direto do bucket `prestacoes` no mesmo domínio da aplicação —
 * evita ad-blockers que barram *.supabase.co (ERR_BLOCKED_BY_CLIENT).
 *
 * GET /api/prestacao/download?path=<orgId>/<mes>/<arquivo>.pdf
 * Header: Authorization: Bearer <supabase-access-token>
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/prestacao/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        if (!path) return new Response("path ausente", { status: 400 });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        // Valida sessão + resolve org do usuário
        const supaUser = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: userData, error: userErr } = await supaUser.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        const { data: orgId, error: orgErr } = await supaUser.rpc("current_user_org");
        if (orgErr || !orgId) return new Response("Sem organização", { status: 403 });

        // Isolamento entre orgs: só permite baixar dentro do próprio prefixo
        if (!path.startsWith(`${orgId}/`)) {
          return new Response("Forbidden", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const dl = await supabaseAdmin.storage.from("prestacoes").download(path);
        if (dl.error || !dl.data) {
          return new Response("PDF não encontrado", { status: 404 });
        }

        const nome = path.split("/").pop() ?? "prestacao.pdf";
        return new Response(dl.data, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${nome}"`,
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
