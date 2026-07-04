/**
 * Schema Zod das Regras SIT por fornecedor (coluna `fornecedores.regras_sit`).
 *
 * Todas as chaves são opcionais. Presença = precedência sobre a inferência
 * baseada em código (`inferirTp*` / `aplicarOverrideFavorecido`).
 */
import { z } from "zod";

export const RegrasSitSchema = z
  .object({
    tp_despesa: z.number().int().positive().nullish(),
    tp_documento_despesa: z.number().int().positive().nullish(),
    tp_documento_pagamento: z.number().int().positive().nullish(),
    cd_modalidade_compra: z.number().int().positive().nullish(),
    tp_doc_fav: z.enum(["CPF", "CNPJ", "EXT"]).nullish(),
    nm_favorecido_override: z.string().max(255).nullish(),
    categoria_padrao: z.string().max(20).nullish(),
    observacao: z.string().max(500).nullish(),
  })
  .strict()
  .default({});

export type RegrasSit = z.infer<typeof RegrasSitSchema>;

/** Parse tolerante — retorna {} se o JSONB estiver malformado. */
export function parseRegrasSit(raw: unknown): RegrasSit {
  const r = RegrasSitSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

/**
 * Templates prontos para uso no formulário do fornecedor.
 * Rótulos em PT-BR, chaves seguem `RegrasSit`.
 */
export const REGRAS_TEMPLATES: Array<{
  id: string;
  label: string;
  descricao: string;
  regras: RegrasSit;
}> = [
  {
    id: "energia",
    label: "Energia elétrica",
    descricao: "Fatura mensal de concessionária (Copel, etc.)",
    regras: {
      tp_documento_despesa: 3,
      tp_doc_fav: "CNPJ",
      categoria_padrao: "3.3.90.39.43",
      tp_despesa: 223,
    },
  },
  {
    id: "agua",
    label: "Água e esgoto",
    descricao: "Fatura mensal de concessionária (Sanepar, etc.)",
    regras: {
      tp_documento_despesa: 3,
      tp_doc_fav: "CNPJ",
      categoria_padrao: "3.3.90.39.44",
      tp_despesa: 224,
    },
  },
  {
    id: "folha",
    label: "Folha / Holerite",
    descricao: "Pagamento de salários (usa regras de data especiais)",
    regras: {
      tp_documento_despesa: 5,
      categoria_padrao: "3.1.90.11.01",
      tp_despesa: 6,
    },
  },
  {
    id: "darf",
    label: "DARF Federal",
    descricao: "Ministério da Fazenda (Receita Federal)",
    regras: {
      tp_documento_despesa: 7,
      tp_doc_fav: "CNPJ",
      nm_favorecido_override: "MINISTERIO DA FAZENDA - MATRIZ",
      categoria_padrao: "3.1.90.47.99",
      tp_despesa: 40,
    },
  },
  {
    id: "gps",
    label: "GPS / INSS",
    descricao: "Guia de Previdência Social",
    regras: {
      tp_documento_despesa: 9,
      tp_doc_fav: "CNPJ",
      nm_favorecido_override: "FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL",
      categoria_padrao: "3.1.90.13.02",
      tp_despesa: 22,
    },
  },
  {
    id: "fgts",
    label: "FGTS (GFIP/GRRF/GFD)",
    descricao: "Guias FGTS – Caixa Econômica",
    regras: {
      tp_documento_despesa: 10,
      tp_doc_fav: "CNPJ",
      nm_favorecido_override: "CAIXA ECONOMICA FEDERAL",
      categoria_padrao: "3.1.90.13.01",
      tp_despesa: 21,
    },
  },
];
