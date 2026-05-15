/**
 * Parser determinístico de NF-e a partir da chave de acesso de 44 dígitos.
 *
 * Layout da chave (44 dígitos):
 *   cUF(2) | AAMM(4) | CNPJ(14) | mod(2) | serie(3) | nNF(9) | tpEmis(1) | cNF(8) | cDV(1)
 *
 * Também tenta capturar o "VALOR TOTAL" (R$) próximo da chave na mesma página.
 */
import { isValidCNPJ } from "@/lib/sit/cnpjValidator";

export type NFeParsed = {
  paginaInicial: number;
  chave: string; // 44 dígitos
  cnpjEmit: string; // 14 dígitos
  numeroNF: string; // sem zeros à esquerda
  aaaa: number;
  mm: number;
  valor: number | null;
  confidence: number; // 0..1
};

const CHAVE_RE = /\b(\d{44})\b/g;

// Tenta achar valor após "VALOR TOTAL" / "VALOR TOTAL DA NOTA" / "TOTAL DA NOTA"
const VALOR_RE =
  /(?:VALOR\s+TOTAL(?:\s+DA\s+NOTA)?|TOTAL\s+DA\s+NOTA|VALOR\s+L[IÍ]QUIDO)[^\d]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i;

function parseValorBR(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

/** Retorna todas as NF-e válidas (chave de 44 dígitos) detectadas na página. */
export function parseNFeAll(textoPagina: string, numeroPagina: number): NFeParsed[] {
  const semEspacos = textoPagina.replace(/\s+/g, "");
  const candidatos = new Set<string>();
  for (const m of textoPagina.matchAll(CHAVE_RE)) candidatos.add(m[1]);
  for (const m of semEspacos.matchAll(CHAVE_RE)) candidatos.add(m[1]);

  const out: NFeParsed[] = [];
  const valorMatch = textoPagina.match(VALOR_RE);
  const valor = valorMatch ? parseValorBR(valorMatch[1]) : null;

  for (const chave of candidatos) {
    const cnpjEmit = chave.slice(6, 20);
    if (!isValidCNPJ(cnpjEmit)) continue;
    const aa = Number(chave.slice(2, 4));
    const mm = Number(chave.slice(4, 6));
    if (mm < 1 || mm > 12) continue;
    const numeroNF = String(Number(chave.slice(25, 34)));
    out.push({
      paginaInicial: numeroPagina,
      chave,
      cnpjEmit,
      numeroNF,
      aaaa: 2000 + aa,
      mm,
      // Quando há múltiplas NF-e na mesma página o "VALOR TOTAL" capturado pode
      // não ser desta nota — só aplicamos quando há exatamente uma NF-e na página.
      valor: candidatos.size === 1 ? valor : null,
      confidence: candidatos.size === 1 && valor ? 0.98 : 0.85,
    });
  }
  return out;
}

export function parseNFe(textoPagina: string, numeroPagina: number): NFeParsed | null {
  return parseNFeAll(textoPagina, numeroPagina)[0] ?? null;
}
