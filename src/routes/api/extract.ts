import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { extracaoSchema, type ExtracaoResultado } from "@/lib/extract/schema";
import { CATEGORIAS } from "@/lib/sit/catalogos";
import { aplicarRegrasHolerite } from "@/lib/sit/regrasHolerite";
import { reforcarComDeterministico } from "@/lib/extract/pipeline";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `Você é um assistente especializado em prestações de contas de Termos de Fomento (TCE-PR / padrão SIT).

Você receberá o TEXTO de um PDF mensal de prestação de contas que contém:
- holerites e folha de pagamento
- notas fiscais e cupons
- boletos / guias (DARF, GPS, GFIP, ISS)
- comprovantes bancários

Sua tarefa é extrair, de forma estruturada, TODAS as despesas pagas no mês, as receitas (parcelas recebidas) e o resumo financeiro.

REGRAS IMPORTANTES:
- Datas SEMPRE no formato AAAA-MM-DD.
- Valores como NÚMEROS (ex: 1250.50). Nunca string formatada.
- nrDocFav: apenas dígitos do CPF/CNPJ.
- tipoDocumento: 1=NF, 2=Recibo, 3=Folha, 4=Guia, 5=Bilhete, 6=Tarifa Bancária, 8=Cupom, 20=Outros.
- subtipoDocumento (obrigatório se tipo 3 ou 4): 4=RPA, 5=Holerite, 7=DARF, 8=DAM-ISS, 9=GPS, 10=GFIP.
- Para guias federais (DARF, GPS, GFIP) o nrDocFav e nome serão sobrescritos depois — use os do próprio documento mesmo.
- sugestaoCategoria: escolha o código que melhor representa o gasto na lista abaixo:
${CATEGORIAS.map((c) => `  ${c.codigo} — ${c.nome}`).join("\n")}
- idInterno: use o código interno que aparecer perto da despesa (ex: 10183728); se não houver, gere "ext-1", "ext-2".
- Pagamentos a funcionários (salários) → 3.1.90.11.01. Rescisão → 3.1.90.94.00. INSS → 3.1.90.13.02. FGTS → 3.1.90.13.01. Energia → 3.3.90.39.43. Água → 3.3.90.39.44. Combustível → 3.3.90.30.01. Aluguel → 3.3.90.36.15. Transporte escolar → 3.3.90.33.03. Telefonia/internet → 3.3.90.40.97.
- descricao: curta e objetiva, no máximo 120 caracteres. Ex.: "Aluguel mar/2025", "Energia março", "Salário João mar/2025". NÃO use frases como "Pagamento referente a..." ou "Conforme nota fiscal nº...".
- Inclua TODAS as despesas; não resuma nem agrupe.`;

const JSON_SHAPE_HINT =
  `\n\nIMPORTANTE: Responda APENAS com um objeto JSON válido (sem markdown, sem \`\`\`), conforme este shape:\n` +
  `{\n  "mesReferencia": "MM/AAAA",\n  "receitas": [{"numeroParcela": number|null, "valor": number, "dataRecebimento": "AAAA-MM-DD"}],\n  "despesas": [{"idInterno": string, "data": "AAAA-MM-DD", "dataEmissao": "AAAA-MM-DD"|null, "favorecido": string, "documento": string, "valor": number, "tipoDocumento": number, "subtipoDocumento": number|null, "tpDocFav": "CPF"|"CNPJ"|"EXT", "nrDocFav": string, "descricao": string, "sugestaoCategoria": string}],\n  "resumo": {"saldoAnterior": number, "transferidos": number, "rendimentos": number, "estornados": number}\n}`;

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const buf =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  const digest = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeJson(text: string): string {
  let cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  return cleaned;
}

async function chamarIA(args: {
  apiKey: string;
  modelo: string;
  pdfBytes: Uint8Array | null;
  pdfText: string;
  mimeType: string;
}): Promise<ExtracaoResultado> {
  const gateway = createLovableAiGatewayProvider(args.apiKey);
  const model = gateway(args.modelo);
  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT + JSON_SHAPE_HINT,
    messages: [
      {
        role: "user",
        content: args.pdfBytes
          ? [
              {
                type: "text",
                text: "Extraia receitas, despesas e resumo desta prestação de contas. Retorne SOMENTE o JSON.",
              },
              { type: "file", data: args.pdfBytes, mediaType: args.mimeType },
            ]
          : [
              {
                type: "text",
                text: `Extraia receitas, despesas e resumo deste texto de prestação de contas. Retorne SOMENTE o JSON.\n\n${args.pdfText}`,
              },
            ],
      },
    ],
  });
  return extracaoSchema.parse(JSON.parse(sanitizeJson(text)));
}

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        console.info("[api/extract] requisição recebida");
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          console.error("[api/extract] LOVABLE_API_KEY ausente");
          return new Response(
            JSON.stringify({ error: "LOVABLE_API_KEY ausente no servidor." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let pdfText = "";
        let mimeType = "application/pdf";
        let pdfBytes: Uint8Array | null = null;

        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("application/json")) {
            const body = (await request.json()) as { text?: string };
            pdfText = body.text ?? "";
          } else {
            const form = await request.formData();
            const file = form.get("file");
            if (file instanceof File) {
              mimeType = file.type || "application/pdf";
              const buf = await file.arrayBuffer();
              pdfBytes = new Uint8Array(buf);
            } else if (typeof form.get("text") === "string") {
              pdfText = String(form.get("text"));
            }
          }
        } catch {
          return new Response(
            JSON.stringify({ error: "Não foi possível ler o corpo da requisição." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!pdfBytes && !pdfText) {
          return new Response(
            JSON.stringify({ error: "Envie um arquivo PDF ou texto." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const MAX_PDF_BYTES = 8 * 1024 * 1024;
        if (pdfBytes && pdfBytes.byteLength > MAX_PDF_BYTES) {
          const mb = (pdfBytes.byteLength / 1024 / 1024).toFixed(1);
          return new Response(
            JSON.stringify({
              error: `PDF muito grande para análise por imagem (${mb} MB). Limite: 8 MB. Dica: use um PDF com texto selecionável (o app extrai o texto antes de enviar) ou divida o arquivo.`,
            }),
            { status: 413, headers: { "Content-Type": "application/json" } },
          );
        }

        // ─── Cache por hash ──────────────────────────────────────────
        const hash = await sha256Hex(pdfBytes ?? pdfText);
        try {
          const { data: cached } = await supabaseAdmin
            .from("extracoes_salvas")
            .select("dados")
            .eq("hash_arquivo", hash)
            .order("criada_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cached?.dados) {
            console.info(`[api/extract] cache HIT (hash=${hash.slice(0, 8)})`);
            return new Response(JSON.stringify(cached.dados), {
              status: 200,
              headers: { "Content-Type": "application/json", "X-Cache": "hit" },
            });
          }
        } catch (e) {
          console.warn("[api/extract] cache lookup falhou, seguindo", e);
        }

        try {
          console.info(
            `[api/extract] chamando IA — pdfBytes=${pdfBytes?.byteLength ?? 0}b, textLen=${pdfText.length}, hash=${hash.slice(0, 8)}`,
          );
          const t0 = Date.now();
          let validated = await chamarIA({
            apiKey,
            modelo: "google/gemini-3-flash-preview",
            pdfBytes,
            pdfText,
            mimeType,
          });
          console.info(`[api/extract] flash respondeu em ${Date.now() - t0}ms`);

          // Retry no Pro quando Flash devolve vazio com contexto rico
          const temContextoRico = !!pdfBytes || pdfText.length > 500;
          if (validated.despesas.length === 0 && temContextoRico) {
            console.info("[api/extract] flash devolveu 0 despesas, tentando Pro");
            try {
              const t1 = Date.now();
              const pro = await chamarIA({
                apiKey,
                modelo: "google/gemini-2.5-pro",
                pdfBytes,
                pdfText,
                mimeType,
              });
              console.info(
                `[api/extract] pro respondeu em ${Date.now() - t1}ms, ${pro.despesas.length} despesas`,
              );
              if (pro.despesas.length > 0) validated = pro;
            } catch (e) {
              console.warn("[api/extract] fallback Pro falhou", e);
            }
          }

          const comRegras = aplicarRegrasHolerite(validated);
          let final: ExtracaoResultado = comRegras;
          if (pdfBytes) {
            try {
              final = (await reforcarComDeterministico(
                pdfBytes,
                comRegras,
              )) as ExtracaoResultado;
            } catch (e) {
              console.warn(
                "[api/extract] pipeline determinístico falhou, retornando só IA",
                e,
              );
            }
          }

          // Persistir cache (best effort; falhas não bloqueiam resposta)
          supabaseAdmin
            .from("extracoes_salvas")
            .insert({
              dados: final,
              hash_arquivo: hash,
              mes_referencia: final.mesReferencia ?? null,
              nome_arquivo: `cache-${hash.slice(0, 8)}`,
            })
            .then(({ error }) => {
              if (error) console.warn("[api/extract] cache insert falhou", error.message);
            });

          return Response.json(final);
        } catch (e: unknown) {
          console.error("[api/extract] erro:", e);
          const err = e as { statusCode?: number; message?: string };
          const status = err.statusCode ?? 500;
          const msg =
            status === 429
              ? "Limite de requisições atingido. Tente novamente em instantes."
              : status === 402
                ? "Créditos esgotados na workspace Lovable AI. Adicione créditos em Settings > Workspace > Usage."
                : status === 502 || status === 504
                  ? "O PDF é muito grande ou a IA demorou demais para responder. Tente um PDF com texto selecionável ou divida o arquivo em partes menores."
                  : err.message ?? "Falha ao extrair dados do PDF.";
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
