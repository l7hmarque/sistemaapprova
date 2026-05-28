import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const EnviarEmailSchema = z.object({
  to: z.string().email().max(255),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(200_000),
  from: z.string().max(255).optional(),
});

/**
 * Envia e-mail transacional via Resend (através do connector gateway).
 * Server-only. Não expõe RESEND_API_KEY ao cliente.
 */
export const enviarEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EnviarEmailSchema.parse(d))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurado");

    const from = data.from || "Approva <onboarding@resend.dev>";
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from,
        to: [data.to],
        subject: data.subject,
        html: data.html,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Falha ao enviar e-mail [${res.status}]: ${JSON.stringify(body)}`);
    }
    return { ok: true, id: (body as any)?.id ?? null };
  });
