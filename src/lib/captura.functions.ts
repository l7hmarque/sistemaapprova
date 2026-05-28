import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const InputSchema = z.object({
  texto: z.string().max(120_000).optional(),
  imagemBase64: z.string().max(12_000_000).optional(),
  pdfBase64: z.string().max(12_000_000).optional(),
  mimeType: z.string().max(100).optional(),
  nomeArquivo: z.string().max(255).optional(),
}).refine(
  (d) => !!(d.texto && d.texto.length > 0) || !!d.imagemBase64 || !!d.pdfBase64,
  { message: "Informe texto, imagemBase64 ou pdfBase64" },
);

const SYSTEM = `Você extrai dados de documentos financeiros brasileiros (boleto, NF/NFS-e, fatura, holerite, comprovante de pagamento, guia DARF/GPS/GFIP, cupom fiscal).
Leia o documento com atenção e retorne SOMENTE JSON válido, sem markdown, no formato exato:
{
  "tipo": "boleto" | "nf" | "fatura" | "holerite" | "comprovante_pgto" | "guia" | "outro",
  "cnpj": "00000000000000" ou null,
  "valor": número (ex: 1234.56) ou null,
  "data": "AAAA-MM-DD" ou null,
  "numero": "string" ou null,
  "descricao": "resumo curto em 1 linha"
}
Regras:
- cnpj: apenas dígitos do EMITENTE/FORNECEDOR (quem cobra), não do cliente. Se houver CPF, use o CPF apenas dígitos.
- valor: valor TOTAL a pagar do documento. Em boletos, use o valor do boleto. Em NF, use o valor total. Em holerite, use o líquido. Sempre número (ponto decimal).
- data: data de vencimento (boleto), data de emissão (NF) ou data de pagamento (comprovante), no formato AAAA-MM-DD.
- numero: número do documento, nota, boleto, NF ou linha digitável curta.
- descricao: 1 linha objetiva (ex.: "Energia COPEL mar/2025", "NF 1234 Papelaria X").
- Se não tiver certeza absoluta sobre um campo, use null. Não invente.`;

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

function sanitizeJson(text: string): string {
  let s = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b > a) s = s.slice(a, b + 1);
  return s;
}

function parseDados(raw: string): DadosExtraidos {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(sanitizeJson(raw)); } catch { /* noop */ }
  const valorNum =
    typeof p.valor === "number" ? p.valor
    : typeof p.valor === "string" ? Number(String(p.valor).replace(/\./g, "").replace(",", ".")) : null;
  const cnpjStr = typeof p.cnpj === "string" ? p.cnpj.replace(/\D/g, "") : null;
  return {
    tipo: typeof p.tipo === "string" ? p.tipo : null,
    cnpj: cnpjStr && cnpjStr.length >= 11 ? cnpjStr : null,
    valor: typeof valorNum === "number" && Number.isFinite(valorNum) ? valorNum : null,
    data: typeof p.data === "string" ? p.data : null,
    numero: typeof p.numero === "string" ? p.numero : null,
    descricao: typeof p.descricao === "string" ? p.descricao : null,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const pure = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(pure);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pareceVazio(d: DadosExtraidos): boolean {
  return (d.tipo === null || d.tipo === "outro") && d.valor === null && d.cnpj === null;
}

type ChamadaArgs = {
  apiKey: string;
  modelo: string;
  texto?: string;
  imagemBase64?: string;
  pdfBase64?: string;
  mimeType?: string;
  nomeArquivo?: string;
};

async function chamarIA(args: ChamadaArgs): Promise<DadosExtraidos> {
  const gateway = createLovableAiGatewayProvider(args.apiKey);
  const model = gateway(args.modelo);

  const parts: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string }
    | { type: "image"; image: string }
  > = [];

  const prefixo = `Arquivo: ${args.nomeArquivo ?? "(sem nome)"}`;
  parts.push({ type: "text", text: `${prefixo}\nExtraia os campos e responda SOMENTE com o JSON.` });

  if (args.pdfBase64) {
    parts.push({
      type: "file",
      data: base64ToBytes(args.pdfBase64),
      mediaType: args.mimeType || "application/pdf",
    });
  } else if (args.imagemBase64) {
    const dataUrl = args.imagemBase64.startsWith("data:")
      ? args.imagemBase64
      : `data:${args.mimeType ?? "image/jpeg"};base64,${args.imagemBase64}`;
    parts.push({ type: "image", image: dataUrl });
  } else if (args.texto) {
    parts.push({ type: "text", text: `Texto extraído do documento:\n${args.texto.slice(0, 60_000)}` });
  }

  const { text } = await generateText({
    model,
    system: SYSTEM,
    messages: [{ role: "user", content: parts }],
  });
  return parseDados(text);
}

export const extrairDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ExtracaoResposta> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, erro: "LOVABLE_API_KEY ausente" };

    const ehVisual = !!data.pdfBase64 || !!data.imagemBase64;
    const modeloPrincipal = ehVisual ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-lite";
    const modeloFallback = "google/gemini-2.5-pro";

    try {
      const r1 = await chamarIA({
        apiKey,
        modelo: modeloPrincipal,
        texto: data.texto,
        imagemBase64: data.imagemBase64,
        pdfBase64: data.pdfBase64,
        mimeType: data.mimeType,
        nomeArquivo: data.nomeArquivo,
      });

      const temContextoRico = (data.texto?.length ?? 0) > 200 || ehVisual;
      if (pareceVazio(r1) && temContextoRico) {
        try {
          const r2 = await chamarIA({
            apiKey,
            modelo: modeloFallback,
            texto: data.texto,
            imagemBase64: data.imagemBase64,
            pdfBase64: data.pdfBase64,
            mimeType: data.mimeType,
            nomeArquivo: data.nomeArquivo,
          });
          if (!pareceVazio(r2)) return { ok: true, dados: r2 };
        } catch (e) {
          console.warn("[extrairDocumento] fallback Pro falhou", e);
        }
      }
      return { ok: true, dados: r1 };
    } catch (e) {
      console.error("[extrairDocumento] falha", e);
      return { ok: false, erro: e instanceof Error ? e.message : "Falha" };
    }
  });
