import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { extracaoSchema } from "@/lib/extract/schema";
import { CATEGORIAS } from "@/lib/sit/catalogos";
import { aplicarRegrasHolerite } from "@/lib/sit/regrasHolerite";

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
- Inclua TODAS as despesas; não resuma nem agrupe.`;

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
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

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");

        try {
          const { text } = await generateText({
            model,
            system:
              SYSTEM_PROMPT +
              `\n\nIMPORTANTE: Responda APENAS com um objeto JSON válido (sem markdown, sem \`\`\`), conforme este shape:\n` +
              `{\n  "mesReferencia": "MM/AAAA",\n  "receitas": [{"numeroParcela": number|null, "valor": number, "dataRecebimento": "AAAA-MM-DD"}],\n  "despesas": [{"idInterno": string, "data": "AAAA-MM-DD", "dataEmissao": "AAAA-MM-DD"|null, "favorecido": string, "documento": string, "valor": number, "tipoDocumento": number, "subtipoDocumento": number|null, "tpDocFav": "CPF"|"CNPJ"|"EXT", "nrDocFav": string, "descricao": string, "sugestaoCategoria": string}],\n  "resumo": {"saldoAnterior": number, "transferidos": number, "rendimentos": number, "estornados": number}\n}`,
            messages: [
              {
                role: "user",
                content: pdfBytes
                  ? [
                      {
                        type: "text",
                        text: "Extraia receitas, despesas e resumo desta prestação de contas. Retorne SOMENTE o JSON.",
                      },
                      { type: "file", data: pdfBytes, mediaType: mimeType },
                    ]
                  : [
                      {
                        type: "text",
                        text: `Extraia receitas, despesas e resumo deste texto de prestação de contas. Retorne SOMENTE o JSON.\n\n${pdfText}`,
                      },
                    ],
              },
            ],
          });

          // Sanitize and parse JSON
          let cleaned = text.trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          const start = cleaned.indexOf("{");
          const end = cleaned.lastIndexOf("}");
          if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);

          const parsed = JSON.parse(cleaned);
          const validated = extracaoSchema.parse(parsed);
          return Response.json(aplicarRegrasHolerite(validated));
        } catch (e: unknown) {
          const err = e as { statusCode?: number; message?: string };
          const status = err.statusCode ?? 500;
          const msg =
            status === 429
              ? "Limite de requisições atingido. Tente novamente em instantes."
              : status === 402
                ? "Créditos esgotados na workspace Lovable AI. Adicione créditos em Settings > Workspace > Usage."
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
