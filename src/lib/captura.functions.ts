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
O PDF/imagem pode conter MAIS DE UM documento (ex.: a nota/boleto + o comprovante de pagamento juntos). Leia TODAS as páginas e CONSOLIDE em um único JSON: use os dados do fornecedor/valor/número da nota ou boleto e a data efetiva do comprovante de pagamento, quando houver.

Retorne SOMENTE JSON válido, sem markdown, no formato exato:
{
  "tipo": "boleto" | "nf" | "fatura" | "holerite" | "comprovante_pgto" | "guia" | "darf" | "gps" | "gfip" | "grrf" | "gfd" | "cupom" | "recibo" | "outro",
  "cnpj": "00000000000000" ou null,
  "razao_social": "string" ou null,
  "valor": número (ex: 1234.56) ou null,
  "numero": "string" ou null,
  "data_emissao": "AAAA-MM-DD" ou null,
  "data_vencimento": "AAAA-MM-DD" ou null,
  "data_pagamento": "AAAA-MM-DD" ou null,
  "descricao": "resumo curto (máx 200 caracteres, SEM o número do documento)",
  "forma_pagamento": "pix" | "ted" | "doc" | "cheque" | "ordem bancaria" | "debito em conta" | "deposito" | null,
  "numero_pagamento": "string" ou null
}
Regras:
- cnpj: apenas dígitos do EMITENTE/FORNECEDOR. Para guias federais (DARF/GPS/GFIP/GRRF/GFD), pode deixar null — o sistema preenche automaticamente.
- razao_social: nome/razão social do EMITENTE/FORNECEDOR exatamente como aparece. Pessoa física: use o nome.
- valor: valor TOTAL a pagar. Sempre número (ponto decimal).
- numero: número da NF/boleto/documento (somente o número).
- data_emissao: data de emissão da NF/fatura.
- data_vencimento: vencimento do boleto/fatura/guia.
- data_pagamento: data EFETIVA do comprovante (PIX, TED, transferência, recibo bancário) quando incluso no PDF.
- descricao: 1 linha objetiva, até 200 caracteres, SEM o número do documento.
- forma_pagamento: identifique se o comprovante foi PIX, TED, DOC, cheque, depósito, ordem bancária ou débito em conta. null se não houver comprovante.
- numero_pagamento: nº de autenticação/transação/ID do comprovante (ID PIX, nº TED, nº cheque), quando houver.
- Identifique guias federais corretamente: DARF (Receita Federal), GPS (INSS), GFIP/GRRF/GFD (Caixa/FGTS).
- Se não tiver certeza, use null. Não invente.`;

export type DadosExtraidos = {
  tipo: string | null;
  cnpj: string | null;
  razao_social: string | null;
  valor: number | null;
  numero: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string | null;
  forma_pagamento: string | null;
  numero_pagamento: string | null;
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

function parseData(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseDados(raw: string): DadosExtraidos {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(sanitizeJson(raw)); } catch { /* noop */ }
  const valorNum =
    typeof p.valor === "number" ? p.valor
    : typeof p.valor === "string" ? Number(String(p.valor).replace(/\./g, "").replace(",", ".")) : null;
  const cnpjStr = typeof p.cnpj === "string" ? p.cnpj.replace(/\D/g, "") : null;
  const razao = typeof p.razao_social === "string" ? p.razao_social.trim() : null;
  const descricaoRaw = typeof p.descricao === "string" ? p.descricao.trim() : null;
  const descricao = descricaoRaw ? descricaoRaw.slice(0, 200) : null;
  // backward-compat: aceita "data" legado caso o modelo retorne
  const dataLegacy = parseData((p as Record<string, unknown>).data);
  return {
    tipo: typeof p.tipo === "string" ? p.tipo : null,
    cnpj: cnpjStr && cnpjStr.length >= 11 ? cnpjStr : null,
    razao_social: razao && razao.length > 0 ? razao : null,
    valor: typeof valorNum === "number" && Number.isFinite(valorNum) ? valorNum : null,
    numero: typeof p.numero === "string" ? p.numero : null,
    data_emissao: parseData(p.data_emissao),
    data_vencimento: parseData(p.data_vencimento) ?? dataLegacy,
    data_pagamento: parseData(p.data_pagamento),
    descricao,
    forma_pagamento: typeof p.forma_pagamento === "string" ? p.forma_pagamento : null,
    numero_pagamento: typeof p.numero_pagamento === "string" ? p.numero_pagamento : null,
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
