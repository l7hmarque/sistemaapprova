/** Catálogos do SIT/TCE-PR — extraídos do Apêndice A do layout oficial. */

/** Tipos de Documento de Despesa — Apêndice A item 16. */
export const TIPOS_DOC_DESPESA = [
  { codigo: 1, nome: "Nota Fiscal" },
  { codigo: 2, nome: "Cupom Fiscal" },
  { codigo: 3, nome: "Fatura" },
  { codigo: 4, nome: "Recibo de Pagamento a Autônomo - RPA" },
  { codigo: 5, nome: "Folha Pagamento/Holerite" },
  { codigo: 6, nome: "GR/PR", cnpj: "76416890000189", favorecido: "SECRETARIA DE ESTADO DA FAZENDA" },
  { codigo: 7, nome: "DARF - Federal", cnpj: "00394460000141", favorecido: "MINISTERIO DA FAZENDA - MATRIZ" },
  { codigo: 8, nome: "DAM - Municipal" },
  { codigo: 9, nome: "GPS", cnpj: "16727230000197", favorecido: "FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL" },
  { codigo: 10, nome: "GFIP", cnpj: "00360305000104", favorecido: "CAIXA ECONOMICA FEDERAL" },
  { codigo: 11, nome: "Romaneio" },
  { codigo: 12, nome: "Bilhete de Passagem" },
  { codigo: 13, nome: "Ticket/Bilhete" },
  { codigo: 14, nome: "Recibo" },
  { codigo: 15, nome: "Apólice" },
  { codigo: 16, nome: "Contrato" },
  { codigo: 17, nome: "Escritura" },
  { codigo: 18, nome: "Aviso de Débito" },
  { codigo: 19, nome: "Invoice (Internacional)" },
  { codigo: 20, nome: "GRRF", cnpj: "00360305000104", favorecido: "CAIXA ECONOMICA FEDERAL" },
  { codigo: 21, nome: "Guia Sindical" },
  { codigo: 22, nome: "Bolsa a Pesquisadores Estrangeiros" },
  { codigo: 23, nome: "GFD - Guia do FGTS Digital", cnpj: "00360305000104", favorecido: "CAIXA ECONOMICA FEDERAL" },
] as const;

/** Override por código de tpDocumentoDespesa (CNPJ + favorecido fixos). */
export const FAVORECIDO_OVERRIDES: Record<number, { cnpj: string; nome: string }> = Object.fromEntries(
  TIPOS_DOC_DESPESA.filter((t): t is typeof t & { cnpj: string; favorecido: string } =>
    "cnpj" in t && typeof t.cnpj === "string",
  ).map((t) => [t.codigo, { cnpj: t.cnpj, nome: t.favorecido }]),
);

/** Tipos de transferência — Apêndice A item 1. */
export const TIPOS_TRANSFERENCIA = [
  { codigo: 1, nome: "Termo de Convênio" },
  { codigo: 5, nome: "Termo de Parceria" },
  { codigo: 7, nome: "Contrato de Gestão" },
  { codigo: 8, nome: "Termo de Colaboração" },
  { codigo: 9, nome: "Termo de Fomento" },
] as const;

/** Modalidades de compra — Apêndice A item 17. */
export const MODALIDADES_COMPRA = [
  { codigo: 1, nome: "Convite" },
  { codigo: 2, nome: "Tomada de Preços" },
  { codigo: 3, nome: "Concorrência" },
  { codigo: 6, nome: "Pregão Presencial" },
  { codigo: 7, nome: "Pregão Eletrônico" },
  { codigo: 8, nome: "Dispensa" },
  { codigo: 9, nome: "Inexigibilidade" },
  { codigo: 11, nome: "Credenciamento" },
  { codigo: 100, nome: "Tributos/Pessoal - aquisição direta" },
  { codigo: 101, nome: "Pesquisa de Preços" },
] as const;

/** Tipos de documento de pagamento — Apêndice A item 18. */
export const TIPOS_DOC_PAGAMENTO = [
  { codigo: 1, nome: "Cheque" },
  { codigo: 2, nome: "Ordem Bancária" },
  { codigo: 3, nome: "Depósito Identificado" },
  { codigo: 4, nome: "DOC" },
  { codigo: 5, nome: "TED" },
  { codigo: 6, nome: "Débito em Conta" },
  { codigo: 7, nome: "PIX" },
] as const;

/** Mapa categoriaCodigo → tpDespesa (Apêndice A item 12). */
export const CATEGORIA_TO_TPDESPESA: Record<string, number> = {
  "3.1.90.11.01": 6,
  "3.1.90.11.43": 13,
  "3.1.90.11.45": 15,
  "3.1.90.13.01": 21,
  "3.1.90.13.02": 22,
  "3.1.90.16.00": 27,
  "3.1.90.47.99": 40,
  "3.1.90.49.00": 41,
  "3.1.90.94.00": 363,
  "3.3.90.30.01": 54,
  "3.3.90.30.07": 60,
  "3.3.90.30.14": 67,
  "3.3.90.30.16": 69,
  "3.3.90.30.22": 75,
  "3.3.90.30.23": 76,
  "3.3.90.33.03": 127,
  "3.3.90.36.15": 149,
  "3.3.90.36.26": 158,
  "3.3.90.36.39": 170,
  "3.3.90.39.05": 197,
  "3.3.90.39.19": 209,
  "3.3.90.39.43": 223,
  "3.3.90.39.44": 224,
  "3.3.90.39.69": 247,
  "3.3.90.39.81": 259,
  "3.3.90.39.99": 271,
  "3.3.90.40.97": 365,
  "3.3.90.47.99": 282,
  "4.4.90.52.52": 342,
  "4.4.90.52.99": 353,
};

/** Migração: (tipo, subtipo) do esquema legado → tpDocumentoDespesa oficial. */
export function migrarTipoLegacy(
  tipo: number,
  subtipo: number | null | undefined,
): number {
  if (tipo === 1) return 1; // NF
  if (tipo === 8) return 2; // Cupom
  if (tipo === 2) return 14; // Recibo
  if (tipo === 3) {
    if (subtipo === 4) return 4; // RPA
    return 5; // Folha
  }
  if (tipo === 4) {
    if (subtipo && [6, 7, 8, 9, 10].includes(subtipo)) return subtipo;
    return 8; // DAM/Município por padrão
  }
  if (tipo === 5) return 12; // Bilhete
  if (tipo === 6) return 14; // Tarifas bancárias → Recibo
  if (tipo === 20) return 14; // Outros → Recibo
  // se já é código oficial (1..23) deixa passar
  if (tipo >= 1 && tipo <= 23) return tipo;
  return 14;
}

// ============================================================
// CATÁLOGOS LEGADOS (mantidos para compatibilidade da extração IA)
// ============================================================

export const TIPOS_DOCUMENTO = TIPOS_DOC_DESPESA;
export const SUBTIPOS_DOCUMENTO: { codigo: number; nome: string }[] = [];
export const TIPOS_COM_SUBTIPO = new Set<number>();

/** Categorias econômicas (REO) com Valor Previsto anual atualizado conforme planilha 03/2026. */
export const CATEGORIAS = [
  { codigo: "3.1.90.11.01", nome: "Vencimentos e salários", previsto: 2048283.54 },
  { codigo: "3.1.90.11.43", nome: "13º salário", previsto: 172484.22 },
  { codigo: "3.1.90.11.45", nome: "Férias - Abono constitucional", previsto: 150689.82 },
  { codigo: "3.1.90.13.01", nome: "FGTS", previsto: 178892.54 },
  { codigo: "3.1.90.13.02", nome: "Contribuições previdenciárias - INSS", previsto: 591638.16 },
  { codigo: "3.1.90.16.00", nome: "Outras despesas variáveis - Pessoal Civil", previsto: 20566.10 },
  { codigo: "3.1.90.47.99", nome: "Outras obrigações tributárias e contributivas", previsto: 22990.16 },
  { codigo: "3.1.90.49.00", nome: "Auxílio-transporte", previsto: 5878.87 },
  { codigo: "3.1.90.94.00", nome: "Indenizações e restituições trabalhistas", previsto: 88611.16 },
  { codigo: "3.3.90.30.01", nome: "Combustíveis e lubrificantes", previsto: 154000.00 },
  { codigo: "3.3.90.30.07", nome: "Gêneros de alimentação", previsto: 235995.77 },
  { codigo: "3.3.90.30.14", nome: "Material educativo e esportivo", previsto: 99450.00 },
  { codigo: "3.3.90.30.16", nome: "Material de expediente", previsto: 53266.19 },
  { codigo: "3.3.90.30.22", nome: "Material de limpeza e higienização", previsto: 45308.56 },
  { codigo: "3.3.90.30.23", nome: "Uniformes, tecidos e aviamentos", previsto: 101847.79 },
  { codigo: "3.3.90.33.03", nome: "Despesas com transporte escolar", previsto: 54900.00 },
  { codigo: "3.3.90.36.15", nome: "Locação de imóvel", previsto: 162500.00 },
  { codigo: "3.3.90.36.26", nome: "Serviços domésticos", previsto: 18200.00 },
  { codigo: "3.3.90.36.39", nome: "Fretes e transportes de encomendas", previsto: 9900.00 },
  { codigo: "3.3.90.39.05", nome: "Serviços técnicos profissionais", previsto: 64491.56 },
  { codigo: "3.3.90.39.19", nome: "Manutenção e conservação de veículos", previsto: 95000.00 },
  { codigo: "3.3.90.39.43", nome: "Serviços de energia elétrica", previsto: 57542.02 },
  { codigo: "3.3.90.39.44", nome: "Serviços de água e esgoto", previsto: 27200.00 },
  { codigo: "3.3.90.39.69", nome: "Seguros em geral", previsto: 21000.00 },
  { codigo: "3.3.90.39.81", nome: "Serviços bancários", previsto: 16.80 },
  { codigo: "3.3.90.39.99", nome: "Outros serviços de terceiros - PJ", previsto: 613811.68 },
  { codigo: "3.3.90.40.97", nome: "Despesas de teleprocessamento", previsto: 9320.00 },
  { codigo: "3.3.90.47.99", nome: "Outras obrigações tributárias", previsto: 14600.00 },
  { codigo: "4.4.90.52.52", nome: "Veículo de tração mecânica", previsto: 66405.00 },
  { codigo: "4.4.90.52.99", nome: "Outros materiais permanentes", previsto: 172570.82 },
] as const;

export type CategoriaCodigo = (typeof CATEGORIAS)[number]["codigo"];

/** Baseline de Valor Gasto por categoria (acumulado até 03/2026). */
export const CATEGORIA_GASTO_BASELINE: Record<string, number> = {
  "3.1.90.11.01": 1599241.59,
  "3.1.90.11.43": 125751.96,
  "3.1.90.11.45": 83020.49,
  "3.1.90.13.01": 165217.46,
  "3.1.90.13.02": 529096.12,
  "3.1.90.16.00": 5472.69,
  "3.1.90.47.99": 11345.45,
  "3.1.90.49.00": 1924.58,
  "3.1.90.94.00": 77120.59,
  "3.3.90.30.01": 66019.24,
  "3.3.90.30.07": 149554.16,
  "3.3.90.30.14": 32944.24,
  "3.3.90.30.16": 13023.84,
  "3.3.90.30.22": 21689.30,
  "3.3.90.30.23": 40432.20,
  "3.3.90.33.03": 36800.00,
  "3.3.90.36.15": 114308.66,
  "3.3.90.36.26": 4315.00,
  "3.3.90.36.39": 2934.00,
  "3.3.90.39.05": 40724.89,
  "3.3.90.39.19": 67029.31,
  "3.3.90.39.43": 25291.71,
  "3.3.90.39.44": 19140.56,
  "3.3.90.39.69": 7190.30,
  "3.3.90.39.81": 16.80,
  "3.3.90.39.99": 367525.82,
  "3.3.90.40.97": 8094.34,
  "3.3.90.47.99": 7321.59,
  "4.4.90.52.52": 66405.00,
  "4.4.90.52.99": 52574.47,
};
