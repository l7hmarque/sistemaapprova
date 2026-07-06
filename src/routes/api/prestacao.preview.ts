import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { montarPdfBytes } from "@/lib/prestacao.functions";

export const Route = createFileRoute("/api/prestacao/preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mes = url.searchParams.get("mes") ?? "";
        const titulo = url.searchParams.get("titulo") ?? undefined;
        if (!/^\d{4}-\d{2}$/.test(mes)) {
          return new Response("mes inválido", { status: 400 });
        }

        const auth = request.headers.get("authorization") || "";
        let token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
        if (!token) token = url.searchParams.get("t");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supa = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: userRes } = await supa.auth.getUser(token);
        if (!userRes?.user) return new Response("Unauthorized", { status: 401 });

        const { data: orgIdRaw } = await supa.rpc("current_user_org");
        const orgId = orgIdRaw as string | null;
        if (!orgId) return new Response("Sem organização", { status: 403 });

        try {
          const result = await montarPdfBytes({ sb: supa, orgId, mes, titulo });
          const headers = new Headers();
          headers.set("content-type", "application/pdf");
          headers.set("cache-control", "private, no-store");
          headers.set("x-total-paginas", String(result.totalPaginas));
          headers.set("x-total-docs", String(result.totalDocs));
          headers.set("x-total-comprovantes", String(result.totalComprovantes));
          return new Response(result.bytes as any, { status: 200, headers });
        } catch (err: any) {
          return new Response(err?.message ?? "Erro ao gerar preview", { status: 500 });
        }
      },
    },
  },
});
