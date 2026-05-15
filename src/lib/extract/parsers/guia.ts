/**
 * Parser determinístico de guias de arrecadação (DARF/GPS/concessionárias).
 *
 * Linha digitável de guia: 48 dígitos, primeiro = 8 (identificador de produto).
 * Layout (códigos com efetivo valor em R$):
 *   pos 0..2  — 8 + segmento + tipoValor (3=R$ real ref, 6/7 = R$ efetivo)
 *   pos 4..14 — valor (11 dígitos, 2 decimais)
 *
 * Também detecta heurísticamente o tipo (DARF/GPS) por palavras-chave próximas.
 */
export type GuiaTipo = "DARF" | "GPS" | "GFIP" | "DESCONHECIDO";

export type GuiaParsed = {
  paginaInicial: number;
  linhaDigitavel: string; // 48 dígitos
  segmento: string; // 1 dígito
  valor: number;
  tipo: GuiaTipo;
  confidence: number;
};

// Linha digitável de guia em 4 grupos de 12 dígitos (com separadores opcionais).
// Estrita: começa com '8' e soma exatamente 48 dígitos.
const LINHA_RE = /\b8\d{11}[\s.-]?\d{12}[\s.-]?\d{12}[\s.-]?\d{11}\b/g;

function detectarTipo(texto: string): GuiaTipo {
  const u = texto.toUpperCase();
  if (/\bDARF\b/.test(u)) return "DARF";
  if (/\bGPS\b|PREVID[EÊ]NCIA\s+SOCIAL/.test(u)) return "GPS";
  if (/\bGFIP\b|\bGRRF\b|\bFGTS\b/.test(u)) return "GFIP";
  return "DESCONHECIDO";
}

/** Retorna todas as linhas digitáveis de guia válidas encontradas na página. */
export function parseGuiaAll(textoPagina: string, numeroPagina: number): GuiaParsed[] {
  const out: GuiaParsed[] = [];
  const vistos = new Set<string>();
  const tipo = detectarTipo(textoPagina);
  for (const m of textoPagina.matchAll(LINHA_RE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length !== 48 || digits[0] !== "8") continue;
    if (vistos.has(digits)) continue;
    vistos.add(digits);
    const segmento = digits[1];
    const tipoValor = digits[2]; // 6/7 = valor efetivo
    if (tipoValor !== "6" && tipoValor !== "7") continue;
    const valorRaw = Number(digits.slice(4, 15));
    if (!Number.isFinite(valorRaw) || valorRaw === 0) continue;
    out.push({
      paginaInicial: numeroPagina,
      linhaDigitavel: digits,
      segmento,
      valor: valorRaw / 100,
      tipo,
      confidence: 0.92,
    });
  }
  return out;
}

/** Compatibilidade: primeira guia encontrada (ou null). */
export function parseGuia(textoPagina: string, numeroPagina: number): GuiaParsed | null {
  return parseGuiaAll(textoPagina, numeroPagina)[0] ?? null;
}
