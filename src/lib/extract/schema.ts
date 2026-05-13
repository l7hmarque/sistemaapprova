import { z } from "zod";

export const receitaSchema = z.object({
  numeroParcela: z.number().int().nullable().optional(),
  valor: z.number(),
  dataRecebimento: z.string().describe("AAAA-MM-DD"),
});

export const despesaExtraidaSchema = z.object({
  idInterno: z.string().describe("Código interno do sistema (ex: 10183728)"),
  data: z.string().describe("Data do pagamento AAAA-MM-DD"),
  dataEmissao: z
    .string()
    .nullable()
    .optional()
    .describe("Data emissão do documento AAAA-MM-DD; se ausente repetir a do pagamento"),
  favorecido: z.string(),
  documento: z.string().describe("Número da NF / recibo / guia / 0 se não houver"),
  valor: z.number().describe("Valor em reais (decimal)"),
  tipoDocumento: z
    .number()
    .int()
    .describe(
      "1=NF, 2=Recibo, 3=Folha, 4=Guia, 5=Bilhete, 6=Tarifa Bancária, 8=Cupom, 20=Outros",
    ),
  subtipoDocumento: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe(
      "Obrigatório se tipo=3 ou 4. 4=RPA, 5=Holerite, 7=DARF, 8=ISS, 9=GPS, 10=GFIP",
    ),
  tpDocFav: z.enum(["CPF", "CNPJ", "EXT"]),
  nrDocFav: z.string().describe("CPF ou CNPJ; apenas dígitos"),
  descricao: z.string().describe("Descrição do gasto / objeto da despesa"),
  sugestaoCategoria: z
    .string()
    .describe("Código de natureza econômica (ex: 3.1.90.11.01)"),
});

export const extracaoSchema = z.object({
  mesReferencia: z.string().describe("Ex: '04/2025' ou 'Abril/2025'"),
  receitas: z.array(receitaSchema),
  despesas: z.array(despesaExtraidaSchema),
  resumo: z.object({
    saldoAnterior: z.number().default(0),
    transferidos: z.number().default(0),
    rendimentos: z.number().default(0),
    estornados: z.number().default(0),
  }),
});

export type ExtracaoResultado = z.infer<typeof extracaoSchema>;
export type DespesaExtraida = z.infer<typeof despesaExtraidaSchema>;
export type ReceitaExtraida = z.infer<typeof receitaSchema>;
