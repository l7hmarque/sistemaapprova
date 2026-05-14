/**
 * Parser determinístico de boleto bancário a partir da linha digitável (47 dígitos).
 *
 * Layout (47 dígitos, com pontos/espaços):
 *   AAAAA.AAAAA BBBBB.BBBBBB CCCCC.CCCCCC D EEEEEEEEEEEEEE
 *   - banco = primeiros 3 dígitos
 *   - moeda = 4º dígito (9 = real)
 *   - fator vencimento = posições 33..37 (5 dígitos) → dias desde 07/10/1997
 *   - valor = posições 38..47 (10 dígitos, 2 casas decimais)
 */
export type BoletoParsed = {
  paginaInicial: number;
  linhaDigitavel: string; // só dígitos (47)
  banco: string; // 3 dígitos
  valor: number; // R$
  vencimento: string | null; // AAAA-MM-DD
  confidence: number;
};

// Captura sequências longas com dígitos e separadores típicos (pontos/espaços).
const LINHA_RE = /\b\d{5}[.\s]?\d{5}\s?\d{5}[.\s]?\d{6}\s?\d{5}[.\s]?\d{6}\s?\d\s?\d{14}\b/g;

const BASE_FATOR = Date.UTC(1997, 9, 7); // 07/10/1997

function fatorParaData(fator: number): string | null {
  if (fator <= 0 || fator > 9999) return null;
  const ms = BASE_FATOR + fator * 86_400_000;
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

export function parseBoleto(textoPagina: string, numeroPagina: number): BoletoParsed | null {
  for (const match of textoPagina.matchAll(LINHA_RE)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length !== 47) continue;
    const banco = digits.slice(0, 3);
    const fator = Number(digits.slice(33, 37));
    const valorRaw = Number(digits.slice(37, 47));
    if (!Number.isFinite(valorRaw) || valorRaw === 0) continue;
    const valor = valorRaw / 100;
    return {
      paginaInicial: numeroPagina,
      linhaDigitavel: digits,
      banco,
      valor,
      vencimento: fatorParaData(fator),
      confidence: 0.95,
    };
  }
  return null;
}
