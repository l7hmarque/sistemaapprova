import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  texto: z.string().min(1).max(120_000),
  nomeArquivo: z.string().max(255).optional(),
});

const SAIDA = `Extraia os campos de um documento financeiro brasileiro (boleto, NF/NFS-e, fatura, holerite, comprovante de pagamento, guia DARF/GPS/GFIP).
Responda APENAS JSON válido no formato:
{
  "tipo": "boleto" | "nf" | "fatura" | "holerite" | "comprovante_pgto" | "guia" | "outro",
  "cnpj": "00000000000000" | null,
  "valor": 1234.56 | null,
  "data": "AAAA-MM-DD" | null,
  "numero": "string ou null",
  "descricao": "resumo curto em 1 linha"
}
Não invente. Se não tiver certeza, use null.`;

export type DadosExtraidos = {
  tipo?: string | null;
  cnpj?: string | null;
  valor?: number | null;
  data?: string | null;
  numero?: string | null;
  descricao?: string | null;
};

export type ExtracaoResposta =
  | { ok: true; dados: DadosExtraidos }
  | { ok: false; erro: string };

export const extrairDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ExtracaoResposta> => {

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, erro: "LOVABLE_API_KEY ausente" };
    }
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SAIDA },
            {
              role: "user",
              content: `Arquivo: ${data.nomeArquivo ?? "(sem nome)"}\n\nTexto extraído:\n${data.texto.slice(0, 60_000)}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("[extrairDocumento] gateway erro", resp.status, t);
        return { ok: false as const, erro: `Gateway ${resp.status}` };
      }
      const j = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = j.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      return { ok: true as const, dados: parsed };
    } catch (e) {
      console.error("[extrairDocumento] falha", e);
      return { ok: false as const, erro: e instanceof Error ? e.message : "Falha" };
    }
  });
