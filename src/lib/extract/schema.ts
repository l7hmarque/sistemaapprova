import { z } from "zod";

// Schema kept intentionally simple/flat for Gemini structured output compatibility.
// - No .default(), no .optional() chained with .nullable(), no enums.
// - All fields required; use nullable for "may be absent".

export const receitaSchema = z.object({
  numeroParcela: z.number().int().nullable().describe("Número da parcela; null se desconhecido"),
  valor: z.number(),
  dataRecebimento: z.string().describe("AAAA-MM-DD"),
});

export const despesaExtraidaSchema = z.object({
  idInterno: z.string().describe("Código interno (ex: 10183728) ou ext-N"),
  data: z.string().describe("Data do pagamento AAAA-MM-DD"),
  dataEmissao: z
    .string()
    .nullable()
    .describe("Data emissão AAAA-MM-DD; null se ausente"),
  favorecido: z.string(),
  documento: z.string().describe("Número da NF/recibo/guia; '0' se não houver"),
  valor: z.number().describe("Valor em reais (decimal)"),
  tipoDocumento: z
    .number()
    .int()
    .describe("1=NF,2=Recibo,3=Folha,4=Guia,5=Bilhete,6=Tarifa,8=Cupom,20=Outros"),
  subtipoDocumento: z
    .number()
    .int()
    .nullable()
    .describe("Se tipo=3 ou 4. 4=RPA,5=Holerite,7=DARF,8=ISS,9=GPS,10=GFIP; null caso contrário"),
  tpDocFav: z.string().describe("CPF, CNPJ ou EXT"),
  nrDocFav: z.string().describe("Apenas dígitos do CPF/CNPJ"),
  descricao: z.string(),
  sugestaoCategoria: z.string().describe("Código natureza econômica (ex: 3.1.90.11.01)"),
  origem: z
    .enum(["nfe-chave", "boleto-linha", "ia"])
    .nullable()
    .optional()
    .describe("Origem da extração; preenchido pela pipeline determinística no servidor"),
  evidencia: z.string().nullable().optional(),
});

export const extracaoSchema = z.object({
  mesReferencia: z.string().describe("Ex: '04/2025'"),
  receitas: z.array(receitaSchema),
  despesas: z.array(despesaExtraidaSchema),
  resumo: z.object({
    saldoAnterior: z.number(),
    transferidos: z.number(),
    rendimentos: z.number(),
    estornados: z.number(),
  }),
});

export type ExtracaoResultado = z.infer<typeof extracaoSchema>;
export type DespesaExtraida = z.infer<typeof despesaExtraidaSchema>;
export type ReceitaExtraida = z.infer<typeof receitaSchema>;
