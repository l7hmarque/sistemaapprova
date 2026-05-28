import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendEmailViaResend } from "./email.server";

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
  .handler(async ({ data }) => sendEmailViaResend(data));
