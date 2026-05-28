/**
 * Endpoint PDF do portal público.
 * GET /api/public/cotacao/:token/pdf  → stream PDF do Sheet gerado.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exportarSheetComoPdf } from "@/lib/cotacoes.server";

export const Route = createFileRoute("/api/public/cotacao/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: convite } = await supabaseAdmin
          .from("convites_cotacao")
          .select("orcamento_id, expira_em, status, razao_social")
          .eq("token", params.token)
          .maybeSingle();
        if (!convite) return new Response("Convite não encontrado", { status: 404 });
        if (new Date(convite.expira_em) < new Date()) {
          return new Response("Convite expirado", { status: 410 });
        }
        if (!convite.orcamento_id) {
          return new Response("Orçamento ainda não submetido", { status: 409 });
        }
        const { data: orc } = await supabaseAdmin
          .from("orcamentos_salvos")
          .select("drive_file_id")
          .eq("id", convite.orcamento_id)
          .single();
        if (!orc?.drive_file_id) return new Response("Sheet não encontrado", { status: 404 });

        try {
          const { bytes } = await exportarSheetComoPdf(orc.drive_file_id);
          const ab = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(ab).set(bytes);
          const safe = (convite.razao_social || "fornecedor").replace(/[^a-zA-Z0-9_-]+/g, "_");
          return new Response(ab, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="orcamento-${safe}.pdf"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("Falha ao exportar PDF:", e);
          return new Response("Falha ao processar solicitação. Tente novamente ou contate o suporte.", { status: 502 });
        }
      },
    },
  },
});
