/**
 * Endpoint chamado pelo pg_cron (1x/minuto) para processar a fila drive_sync_queue.
 * Autenticação: header `apikey` = SUPABASE_PUBLISHABLE_KEY (anon).
 */
import { createFileRoute } from "@tanstack/react-router";
import { processDriveQueueTick } from "@/lib/drive-queue.server";

export const Route = createFileRoute("/api/public/hooks/drive-sync-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!anon || !provided || provided !== anon) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const url = new URL(request.url);
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 20);
          const result = await processDriveQueueTick(limit);
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[drive-sync-tick] erro:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
