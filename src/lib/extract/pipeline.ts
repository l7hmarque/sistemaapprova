/**
 * Pipeline determinística que reforça a extração da IA.
 *
 * Estratégia:
 *  1. Extrai texto por página com unpdf.
 *  2. Em cada página: tenta NF-e (chave 44) e boleto (linha digitável 47).
 *  3. Para cada despesa retornada pela IA, procura um match determinístico pelo
 *     valor (tolerância de 1 centavo). Quando encontra:
 *       - sobrescreve `nrDocFav` (CNPJ da chave NF-e), `documento` (nº NF) e `valor`;
 *       - marca `origem` como "nfe-chave" ou "boleto-linha".
 *  4. Despesas sem match continuam com origem "ia".
 */
import type { ExtracaoResultado, DespesaExtraida } from "./schema";
import { extrairTextoPorPagina, normalizarTexto } from "./pdfText";
import { parseNFe, type NFeParsed } from "./parsers/nfe";
import { parseBoleto, type BoletoParsed } from "./parsers/boleto";

export type OrigemCampo = "nfe-chave" | "boleto-linha" | "ia";

export type DespesaEnriquecida = DespesaExtraida & {
  origem: OrigemCampo;
  evidencia?: string; // ex.: "Página 3 — chave NF-e 4123..."
};

export type ExtracaoEnriquecida = Omit<ExtracaoResultado, "despesas"> & {
  despesas: DespesaEnriquecida[];
};

const TOLERANCIA = 0.011;

export async function reforcarComDeterministico(
  pdfBytes: Uint8Array,
  resultadoIA: ExtracaoResultado,
): Promise<ExtracaoEnriquecida> {
  let nfes: NFeParsed[] = [];
  let boletos: BoletoParsed[] = [];

  try {
    const paginas = await extrairTextoPorPagina(pdfBytes);
    for (const p of paginas) {
      const txt = normalizarTexto(p.texto);
      const nfe = parseNFe(txt, p.numero);
      if (nfe) nfes.push(nfe);
      const bol = parseBoleto(txt, p.numero);
      if (bol) boletos.push(bol);
    }
  } catch (e) {
    console.warn("[pipeline] falha extraindo texto do PDF, seguindo apenas com IA", e);
  }

  // Marca usados para não mapear o mesmo achado em despesas duplicadas.
  const nfeUsado = new Set<number>();
  const boletoUsado = new Set<number>();

  const despesas: DespesaEnriquecida[] = resultadoIA.despesas.map((d) => {
    // Tenta NF-e primeiro (mais informações).
    const idxNF = nfes.findIndex(
      (n, i) =>
        !nfeUsado.has(i) && n.valor != null && Math.abs(n.valor - d.valor) <= TOLERANCIA,
    );
    if (idxNF >= 0) {
      nfeUsado.add(idxNF);
      const n = nfes[idxNF];
      return {
        ...d,
        nrDocFav: n.cnpjEmit,
        tpDocFav: "CNPJ",
        documento: n.numeroNF,
        valor: n.valor ?? d.valor,
        tipoDocumento: 1, // NF
        origem: "nfe-chave",
        evidencia: `Pág ${n.paginaInicial} — chave NF-e ${n.chave.slice(0, 8)}…${n.chave.slice(-4)}`,
      };
    }

    const idxBol = boletos.findIndex(
      (b, i) => !boletoUsado.has(i) && Math.abs(b.valor - d.valor) <= TOLERANCIA,
    );
    if (idxBol >= 0) {
      boletoUsado.add(idxBol);
      const b = boletos[idxBol];
      return {
        ...d,
        valor: b.valor,
        origem: "boleto-linha",
        evidencia: `Pág ${b.paginaInicial} — boleto banco ${b.banco}, linha ${b.linhaDigitavel.slice(0, 6)}…${b.linhaDigitavel.slice(-4)}`,
      };
    }

    return { ...d, origem: "ia" };
  });

  return { ...resultadoIA, despesas };
}
