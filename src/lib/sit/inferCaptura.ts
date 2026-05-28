/**
 * Helpers para mapear o resultado da IA da captura → campos SIT
 * persistidos diretamente em `eventos_financeiros`.
 */
import { FAVORECIDO_OVERRIDES, CATEGORIAS, CATEGORIA_TO_TPDESPESA } from "./catalogos";

export type CamposSIT = {
  tp_documento_despesa: number | null;
  tp_doc_fav: "CPF" | "CNPJ" | "EXT" | null;
  nr_doc_fav: string | null;
  nm_favorecido: string | null;
  nr_documento: string | null;
  tp_documento_pagamento: number | null;
  tp_despesa: number | null;
  cd_modalidade_compra: number | null;
};

const TIPO_TO_DOC_DESPESA: Record<string, number> = {
  nf: 1, "nf-e": 1, nfe: 1, nfse: 1, "nfs-e": 1, "nota fiscal": 1,
  cupom: 2, "cupom fiscal": 2,
  fatura: 3,
  rpa: 4, "recibo de pagamento a autônomo": 4,
  holerite: 5, folha: 5,
  "gr/pr": 6,
  darf: 7,
  dam: 8,
  gps: 9,
  gfip: 10,
  grrf: 20,
  gfd: 23,
  recibo: 14,
  comprovante_pgto: 14, comprovante: 14,
  boleto: 3, // boleto sem nota → fatura
  guia: 14,
  outro: 14,
};

const PAG_TO_CODIGO: Record<string, number> = {
  pix: 7,
  ted: 5,
  doc: 4,
  cheque: 1,
  "ordem bancaria": 2, "ordem bancária": 2,
  deposito: 3, depósito: 3,
  "debito em conta": 6, "débito em conta": 6,
  "debito automatico": 6, "débito automático": 6,
};

export function inferirTpDocDespesa(
  tipo: string | null | undefined,
  descricao: string | null | undefined,
): number | null {
  const t = (tipo ?? "").toLowerCase().trim();
  if (t && TIPO_TO_DOC_DESPESA[t] != null) return TIPO_TO_DOC_DESPESA[t];
  const txt = `${tipo ?? ""} ${descricao ?? ""}`.toLowerCase();
  if (/\bnfs?e?\b|nota\s*fiscal/.test(txt)) return 1;
  if (/holerite|folha|sal[áa]rio/.test(txt)) return 5;
  if (/darf/.test(txt)) return 7;
  if (/\bgps\b|inss|previd[êe]nc/.test(txt)) return 9;
  if (/gfip/.test(txt)) return 10;
  if (/grrf/.test(txt)) return 20;
  if (/\bgfd\b|fgts\s*digital/.test(txt)) return 23;
  if (/cupom/.test(txt)) return 2;
  if (/fatura|boleto/.test(txt)) return 3;
  if (/recibo|comprovante/.test(txt)) return 14;
  return null;
}

export function inferirTpDocPagamento(
  tipoOuDescricao: string | null | undefined,
): number | null {
  const txt = (tipoOuDescricao ?? "").toLowerCase();
  if (!txt) return null;
  if (/\bpix\b/.test(txt)) return 7;
  if (/\bted\b/.test(txt)) return 5;
  if (/\bdoc\b/.test(txt)) return 4;
  if (/cheque/.test(txt)) return 1;
  if (/ordem\s*banc/.test(txt)) return 2;
  if (/dep[oó]sito/.test(txt)) return 3;
  if (/d[eé]bito\s*(em|autom)/.test(txt)) return 6;
  return null;
}

export function inferirTpDocFav(cnpj: string | null | undefined): "CPF" | "CNPJ" | null {
  if (!cnpj) return null;
  const d = String(cnpj).replace(/\D/g, "");
  if (d.length === 14) return "CNPJ";
  if (d.length === 11) return "CPF";
  return null;
}

const CATEGORIA_KEYWORDS: Array<{ regex: RegExp; codigo: string }> = [
  { regex: /energia|copel|eletric/i, codigo: "3.3.90.39.43" },
  { regex: /[áa]gua|sanepar|esgoto/i, codigo: "3.3.90.39.44" },
  { regex: /aluguel|loca[çc][ãa]o.*im[óo]vel/i, codigo: "3.3.90.36.15" },
  { regex: /combust[íi]vel|gasolina|diesel|etanol/i, codigo: "3.3.90.30.01" },
  { regex: /alimenta[çc][ãa]o|g[êe]neros/i, codigo: "3.3.90.30.07" },
  { regex: /material\s*(de\s*)?(expediente|escrit[óo]rio)/i, codigo: "3.3.90.30.16" },
  { regex: /limpeza|higien/i, codigo: "3.3.90.30.22" },
  { regex: /uniforme|tecido/i, codigo: "3.3.90.30.23" },
  { regex: /transporte\s*escolar/i, codigo: "3.3.90.33.03" },
  { regex: /seguro/i, codigo: "3.3.90.39.69" },
  { regex: /banc[áa]ri|tarifa/i, codigo: "3.3.90.39.81" },
  { regex: /manuten[çc][ãa]o.*ve[íi]culo|conserto.*ve[íi]culo/i, codigo: "3.3.90.39.19" },
  { regex: /sal[áa]rio|vencimento|folha/i, codigo: "3.1.90.11.01" },
  { regex: /13[ºo]\s*sal[áa]rio/i, codigo: "3.1.90.11.43" },
  { regex: /f[ée]rias/i, codigo: "3.1.90.11.45" },
  { regex: /\bfgts\b/i, codigo: "3.1.90.13.01" },
  { regex: /\binss\b|previd[êe]nc/i, codigo: "3.1.90.13.02" },
  { regex: /vale.*transporte|aux[íi]lio.*transporte/i, codigo: "3.1.90.49.00" },
  { regex: /servi[çc]o.*(t[ée]cnic|profissional|contabil|advoc)/i, codigo: "3.3.90.39.05" },
  { regex: /internet|teleproc|telefon/i, codigo: "3.3.90.40.97" },
  { regex: /tribut|imposto|darf|gps|gfip/i, codigo: "3.1.90.47.99" },
];

export function inferirTpDespesa(
  descricao: string | null | undefined,
  tipo: string | null | undefined,
): number | null {
  const txt = `${tipo ?? ""} ${descricao ?? ""}`.toLowerCase();
  if (!txt.trim()) return null;
  for (const k of CATEGORIA_KEYWORDS) {
    if (k.regex.test(txt)) {
      const cod = CATEGORIA_TO_TPDESPESA[k.codigo];
      if (cod != null) return cod;
    }
  }
  return null;
}

const FAVORECIDO_REGEX_OVERRIDES: Array<{
  regex: RegExp; cnpj: string; nome: string; tpDocDespesa?: number;
}> = [
  { regex: /\bsanepar\b/i, cnpj: "76484013000145", nome: "COMPANHIA DE SANEAMENTO DO PARANA - SANEPAR" },
  { regex: /\bcopel\b/i, cnpj: "76483817000120", nome: "COPEL DISTRIBUICAO S.A." },
];

/**
 * Aplica overrides automáticos de favorecido (DARF → MF, GPS → FRGPS,
 * GFIP/GRRF/GFD → CAIXA, Sanepar, Copel). Retorna campos atualizados.
 */
export function aplicarOverrideFavorecido(input: {
  tp_documento_despesa: number | null;
  tp_doc_fav: "CPF" | "CNPJ" | "EXT" | null;
  nr_doc_fav: string | null;
  nm_favorecido: string | null;
  razao_social_ia?: string | null;
}): {
  tp_doc_fav: "CPF" | "CNPJ" | "EXT" | null;
  nr_doc_fav: string | null;
  nm_favorecido: string | null;
} {
  // 1) override por tipo de documento (DARF/GPS/GFIP/GRRF/GFD)
  if (input.tp_documento_despesa != null && FAVORECIDO_OVERRIDES[input.tp_documento_despesa]) {
    const o = FAVORECIDO_OVERRIDES[input.tp_documento_despesa];
    return { tp_doc_fav: "CNPJ", nr_doc_fav: o.cnpj, nm_favorecido: o.nome };
  }
  // 2) override por nome (Sanepar/Copel)
  const nome = `${input.nm_favorecido ?? ""} ${input.razao_social_ia ?? ""}`;
  for (const o of FAVORECIDO_REGEX_OVERRIDES) {
    if (o.regex.test(nome)) {
      return { tp_doc_fav: "CNPJ", nr_doc_fav: o.cnpj, nm_favorecido: o.nome };
    }
  }
  return {
    tp_doc_fav: input.tp_doc_fav,
    nr_doc_fav: input.nr_doc_fav,
    nm_favorecido: input.nm_favorecido,
  };
}

export function gerarIdInterno(mesReferencia: string, seq: number): string {
  // ex.: 2025-03-0042-a1b2c3 → ≤30 chars. Sufixo aleatório evita colisão
  // dentro do mesmo lote/concorrência (UNIQUE INDEX no banco confirma).
  const arr = new Uint8Array(3);
  (globalThis.crypto ?? require("crypto")).getRandomValues(arr);
  const rand = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${mesReferencia}-${String(seq).padStart(4, "0")}-${rand}`.slice(0, 30);
}

/** Lista de campos faltantes para emissão SIT. */
export function pendenciasSIT(e: {
  tp_despesa: number | null;
  tp_documento_despesa: number | null;
  tp_doc_fav: string | null;
  nr_doc_fav: string | null;
  nm_favorecido: string | null;
  valor_efetivo: number | null;
  data_pagamento: string | null;
  data_emissao: string | null;
  tp_documento_pagamento: number | null;
  cd_modalidade_compra: number | null;
}): string[] {
  const f: string[] = [];
  if (e.tp_despesa == null) f.push("tp despesa (REO)");
  if (e.tp_documento_despesa == null) f.push("tipo doc despesa");
  if (!e.tp_doc_fav) f.push("tipo doc favorecido");
  if (!e.nr_doc_fav) f.push("nº doc favorecido");
  if (!e.nm_favorecido) f.push("nome favorecido");
  if (e.valor_efetivo == null) f.push("valor efetivo");
  if (!e.data_emissao) f.push("data emissão");
  if (!e.data_pagamento) f.push("data pagamento");
  if (e.tp_documento_pagamento == null) f.push("tipo doc pagamento");
  if (e.cd_modalidade_compra == null) f.push("modalidade compra");
  return f;
}

export { CATEGORIAS };
