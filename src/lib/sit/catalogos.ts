/** Catálogos do SIT/TCE-PR — tipos, subtipos e categorias econômicas. */

export const TIPOS_DOCUMENTO = [
  { codigo: 1, nome: "Nota Fiscal / NF-e" },
  { codigo: 2, nome: "Recibo" },
  { codigo: 3, nome: "Folha de Pagamento" },
  { codigo: 4, nome: "Guia de Recolhimento" },
  { codigo: 5, nome: "Bilhete de Passagem" },
  { codigo: 6, nome: "Tarifas Bancárias" },
  { codigo: 8, nome: "Cupom Fiscal" },
  { codigo: 20, nome: "Outros Documentos Comprobatórios" },
] as const;

export const SUBTIPOS_DOCUMENTO = [
  { codigo: 4, nome: "RPA - Recibo Pagamento Autônomo" },
  { codigo: 5, nome: "Folha / Holerite" },
  { codigo: 6, nome: "GR/PR - Estado Paraná" },
  { codigo: 7, nome: "DARF - Federal" },
  { codigo: 8, nome: "DAM - ISS Municipal" },
  { codigo: 9, nome: "GPS - Previdência Social" },
  { codigo: 10, nome: "GFIP - FGTS" },
] as const;

/** Indica que um tipo exige preenchimento do subtipo. */
export const TIPOS_COM_SUBTIPO = new Set([3, 4]);

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

/**
 * Baseline de Valor Gasto por categoria (acumulado até 03/2026, conforme planilha
 * saldoCategoriaEcon). As despesas lançadas no app somam por cima deste baseline
 * para compor o gasto efetivo da Execução Orçamentária.
 */
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
