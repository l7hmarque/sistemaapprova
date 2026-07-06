/**
 * Processa jobs de captura em segundo plano.
 * - POST { jobId } → processa o job específico (usado no fire-and-forget do cliente com keepalive).
 * - POST {}       → processa até 5 jobs pendentes mais antigos (usado pelo pg_cron a cada minuto).
 * Auth: header `apikey` = SUPABASE_PUBLISHABLE_KEY.
 */
import { createFileRoute } from "@tanstack/react-router";
import { processarCapturaJob, processarPendentes } from "@/lib/captura-processor.server";

export const Route = createFileRoute("/api/public/hooks/captura-worker")({
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
          let jobId: string | undefined;
          try {
            const body = (await request.json()) as { jobId?: string } | null;
            jobId = body?.jobId;
          } catch {
            /* corpo vazio → processa pendentes */
          }
          if (jobId) {
            await processarCapturaJob(jobId);
            return new Response(JSON.stringify({ ok: true, jobId }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          const url = new URL(request.url);
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 20);
          const result = await processarPendentes(limit);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[captura-worker] erro:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
