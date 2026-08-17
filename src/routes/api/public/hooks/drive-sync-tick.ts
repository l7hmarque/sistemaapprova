/**
 * Endpoint chamado pelo pg_cron (1x/minuto) para processar a fila drive_sync_queue.
 * Autenticação: header `x-cron-secret` = CRON_SECRET (ou `apikey` = chave publicável).
 */
import { createFileRoute } from "@tanstack/react-router";
import { processDriveQueueTick } from "@/lib/drive-queue.server";
import { hookAutorizado, respostaNaoAutorizado } from "@/lib/hooks-auth.server";

export const Route = createFileRoute("/api/public/hooks/drive-sync-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hookAutorizado(request)) return respostaNaoAutorizado();
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
