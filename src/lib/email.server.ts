// Helper server-only para enviar e-mails via Resend gateway.
// Usado pelos server functions (não exposto ao cliente).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendEmailViaResend(input: EmailInput): Promise<{ ok: true; id: string | null }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurado");

  const from = input.from || "Approva <onboarding@resend.dev>";
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Falha ao enviar e-mail [${res.status}]: ${JSON.stringify(body)}`);
  }
  return { ok: true, id: (body as any)?.id ?? null };
}
