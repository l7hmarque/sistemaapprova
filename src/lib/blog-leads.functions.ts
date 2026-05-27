import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Captura leve de lead a partir de posts do blog (material gratuito).
 * Apenas email + nome da OSC. Sem rate limit explícito além da unicidade do email.
 */

const BlogLeadSchema = z.object({
  email: z.string().trim().email().max(200),
  osc_nome: z.string().trim().min(2).max(200),
  origem: z.string().trim().max(80),
  download_slug: z.string().trim().max(80),
  hp: z.string().max(0).optional(),
});

export const capturarLeadBlog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BlogLeadSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.hp && data.hp.length > 0) {
      return { ok: true };
    }

    const req = getRequest();
    const ua = req.headers.get("user-agent") ?? null;
    const ref = req.headers.get("referer") ?? null;

    const insertPayload = {
      nome: data.osc_nome,
      email: data.email.toLowerCase(),
      telefone: "—",
      cargo: "—",
      osc_nome: data.osc_nome,
      plano: "essencial",
      publico: "gestor",
      origem_descoberta: data.origem,
      referrer: ref,
      user_agent: ua,
      observacoes_internas: `Download: ${data.download_slug}`,
    };

    const { error } = await supabaseAdmin.from("leads").insert(insertPayload);
    if (error && !error.message.includes("duplicate")) {
      console.error("[blog-lead] insert failed", error);
    }

    return { ok: true, downloadUrl: `/downloads/painel-scfv-tcepr.xlsx` };
  });
