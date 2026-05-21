import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  texto: z.string().max(120_000).optional(),
  imagemBase64: z.string().max(8_000_000).optional(), // data URL ou base64 puro
  mimeType: z.string().max(100).optional(),
  nomeArquivo: z.string().max(255).optional(),
}).refine((d) => !!(d.texto && d.texto.length > 0) || !!d.imagemBase64, {
  message: "Informe texto ou imagemBase64",
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
  tipo: string | null;
  cnpj: string | null;
  valor: number | null;
  data: string | null;
  numero: string | null;
  descricao: string | null;
};

export type ExtracaoResposta =
  | { ok: true; dados: DadosExtraidos }
  | { ok: false; erro: string };

type Msg = { role: "system" | "user"; content: unknown };

function montarMensagens(args: {
  texto?: string;
  imagemBase64?: string;
  mimeType?: string;
  nomeArquivo?: string;
}): Msg[] {
  const userParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (args.texto) {
    userParts.push({
      type: "text",
      text: `Arquivo: ${args.nomeArquivo ?? "(sem nome)"}\n\nTexto extraído:\n${args.texto.slice(0, 60_000)}`,
    });
  }
  if (args.imagemBase64) {
    const dataUrl = args.imagemBase64.startsWith("data:")
      ? args.imagemBase64
      : `data:${args.mimeType ?? "image/jpeg"};base64,${args.imagemBase64}`;
    userParts.unshift({
      type: "text",
      text: `Arquivo: ${args.nomeArquivo ?? "(sem nome)"}. Extraia os dados visíveis na imagem.`,
    });
    userParts.push({ type: "image_url", image_url: { url: dataUrl } });
  }
  return [
    { role: "system", content: SAIDA },
    { role: "user", content: userParts },
  ];
}

async function chamarGateway(apiKey: string, modelo: string, mensagens: Msg[]) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      messages: mensagens,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    return { ok: false as const, status: resp.status, erro: t };
  }
  const j = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }
  const dados: DadosExtraidos = {
    tipo: typeof parsed.tipo === "string" ? parsed.tipo : null,
    cnpj: typeof parsed.cnpj === "string" ? parsed.cnpj : null,
    valor: typeof parsed.valor === "number" ? parsed.valor : null,
    data: typeof parsed.data === "string" ? parsed.data : null,
    numero: typeof parsed.numero === "string" ? parsed.numero : null,
    descricao: typeof parsed.descricao === "string" ? parsed.descricao : null,
  };
  return { ok: true as const, dados };
}

function pareceVazio(d: DadosExtraidos): boolean {
  return (d.tipo === null || d.tipo === "outro") && d.valor === null && d.cnpj === null;
}

export const extrairDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ExtracaoResposta> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, erro: "LOVABLE_API_KEY ausente" };

    const ehImagem = !!data.imagemBase64;
    const modeloPrincipal = ehImagem
      ? "google/gemini-2.5-flash"        // multimodal
      : "google/gemini-2.5-flash-lite";  // texto barato
    const modeloFallback = "google/gemini-2.5-pro";

    const mensagens = montarMensagens({
      texto: data.texto,
      imagemBase64: data.imagemBase64,
      mimeType: data.mimeType,
      nomeArquivo: data.nomeArquivo,
    });

    try {
      const r1 = await chamarGateway(apiKey, modeloPrincipal, mensagens);
      if (!r1.ok) {
        console.error("[extrairDocumento] gateway erro principal", r1.status, r1.erro);
        // fallback direto se principal falhou de vez
        const r2 = await chamarGateway(apiKey, modeloFallback, mensagens);
        if (!r2.ok) return { ok: false, erro: `Gateway ${r2.status}` };
        return { ok: true, dados: r2.dados, modelo: modeloFallback, fallback: true };
      }
      // se principal devolveu nada útil e temos contexto rico, tenta Pro
      const temContextoRico = (data.texto?.length ?? 0) > 200 || ehImagem;
      if (pareceVazio(r1.dados) && temContextoRico) {
        console.info("[extrairDocumento] principal vazio, tentando Pro");
        const r2 = await chamarGateway(apiKey, modeloFallback, mensagens);
        if (r2.ok && !pareceVazio(r2.dados)) {
          return { ok: true, dados: r2.dados, modelo: modeloFallback, fallback: true };
        }
      }
      return { ok: true, dados: r1.dados, modelo: modeloPrincipal, fallback: false };
    } catch (e) {
      console.error("[extrairDocumento] falha", e);
      return { ok: false, erro: e instanceof Error ? e.message : "Falha" };
    }
  });
