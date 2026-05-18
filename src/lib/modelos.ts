// Tipos e helpers compartilhados (client + server) para modelos de planilha.

export type TipoModelo = "orcamento" | "mapa" | "controle_bancario";

export type ModeloParams = {
  linhaPrimeiroItem1: number;
  qtdLinhasExistentes: number;
  linhaTotais1: number;
  colCount: number;
};

export type Modelo = {
  id: string;
  tipo: TipoModelo;
  nome: string;
  template_id: string;
  aba: string;
  params: Partial<ModeloParams>;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

/** Extrai o ID de uma URL completa do Google Sheets ou retorna a string como está. */
export function extrairSheetId(input: string): string {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return (m ? m[1] : s).trim();
}

export const TIPO_LABEL: Record<TipoModelo, string> = {
  orcamento: "Orçamento",
  mapa: "Mapa Comparativo",
  controle_bancario: "Controle Bancário",
};
