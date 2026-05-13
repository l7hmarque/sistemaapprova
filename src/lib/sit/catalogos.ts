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

/** Categorias econômicas (REO) com Valor Previsto anual. */
export const CATEGORIAS = [
  { codigo: "3.1.90.11.01", nome: "Vencimentos e salários", previsto: 1802789.73 },
  { codigo: "3.1.90.11.43", nome: "13º salário", previsto: 152026.40 },
  { codigo: "3.1.90.11.45", nome: "Férias - Abono constitucional", previsto: 100411.33 },
  { codigo: "3.1.90.13.01", nome: "FGTS", previsto: 159253.04 },
  { codigo: "3.1.90.13.02", nome: "Contribuições previdenciárias - INSS", previsto: 541641.05 },
  { codigo: "3.1.90.16.00", nome: "Outras despesas variáveis - Pessoal Civil", previsto: 15566.10 },
  { codigo: "3.1.90.47.99", nome: "Outras obrigações tributárias e contributivas", previsto: 20262.45 },
  { codigo: "3.1.90.49.00", nome: "Auxílio-transporte", previsto: 4878.87 },
  { codigo: "3.1.90.94.00", nome: "Indenizações e restituições trabalhistas", previsto: 79882.49 },
  { codigo: "3.3.90.30.01", nome: "Combustíveis e lubrificantes", previsto: 134000.00 },
  { codigo: "3.3.90.30.07", nome: "Gêneros de alimentação", previsto: 200995.77 },
  { codigo: "3.3.90.30.14", nome: "Material educativo e esportivo", previsto: 89450.00 },
  { codigo: "3.3.90.30.16", nome: "Material de expediente", previsto: 48266.19 },
  { codigo: "3.3.90.30.22", nome: "Material de limpeza e higienização", previsto: 35308.56 },
  { codigo: "3.3.90.30.23", nome: "Uniformes, tecidos e aviamentos", previsto: 86847.79 },
  { codigo: "3.3.90.33.03", nome: "Despesas com transporte escolar", previsto: 54900.00 },
  { codigo: "3.3.90.36.15", nome: "Locação de imóvel", previsto: 126500.00 },
  { codigo: "3.3.90.36.26", nome: "Serviços domésticos", previsto: 14200.00 },
  { codigo: "3.3.90.36.39", nome: "Fretes e transportes de encomendas", previsto: 9900.00 },
  { codigo: "3.3.90.39.05", nome: "Serviços técnicos profissionais", previsto: 54491.56 },
  { codigo: "3.3.90.39.19", nome: "Manutenção e conservação de veículos", previsto: 90000.00 },
  { codigo: "3.3.90.39.43", nome: "Serviços de energia elétrica", previsto: 45542.02 },
  { codigo: "3.3.90.39.44", nome: "Serviços de água e esgoto", previsto: 24200.00 },
  { codigo: "3.3.90.39.69", nome: "Seguros em geral", previsto: 21000.00 },
  { codigo: "3.3.90.39.81", nome: "Serviços bancários", previsto: 16.80 },
  { codigo: "3.3.90.39.99", nome: "Outros serviços de terceiros - PJ", previsto: 514659.87 },
  { codigo: "3.3.90.40.97", nome: "Despesas de teleprocessamento", previsto: 8320.00 },
  { codigo: "3.3.90.47.99", nome: "Outras obrigações tributárias", previsto: 12600.00 },
  { codigo: "4.4.90.52.52", nome: "Veículo de tração mecânica", previsto: 66405.00 },
  { codigo: "4.4.90.52.99", nome: "Outros materiais permanentes", previsto: 152570.82 },
] as const;

export type CategoriaCodigo = (typeof CATEGORIAS)[number]["codigo"];
