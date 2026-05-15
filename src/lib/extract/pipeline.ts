/**
 * Pipeline determinística que reforça a extração da IA.
 *
 * Estratégia:
 *  1. Extrai texto por página com unpdf.
 *  2. Em cada página: tenta NF-e (chave 44), boleto (47) e guia de arrecadação (48).
 *  3. Para cada despesa retornada pela IA, procura match determinístico pelo valor.
 *     Quando encontra, sobrescreve campos com confiança alta e marca a `origem`.
 *  4. Aplica overrides de favorecidos padrão (DARF/GPS/GFIP/Sanepar/Copel).
 */
import type { ExtracaoResultado, DespesaExtraida } from "./schema";
import { extrairTextoPorPagina, normalizarTexto } from "./pdfText";
import { parseNFe, type NFeParsed } from "./parsers/nfe";
import { parseBoleto, type BoletoParsed } from "./parsers/boleto";
import { parseGuia, type GuiaParsed } from "./parsers/guia";
import { aplicarFavorecidoPadrao } from "./favorecidosPadrao";

export type OrigemCampo =
  | "nfe-chave"
  | "boleto-linha"
  | "guia-linha"
  | "favorecido-padrao"
  | "ia";

export type DespesaEnriquecida = DespesaExtraida & {
  origem: OrigemCampo;
  evidencia?: string | null;
};

export type ExtracaoEnriquecida = Omit<ExtracaoResultado, "despesas"> & {
  despesas: DespesaEnriquecida[];
};

const TOLERANCIA = 0.011;

export async function reforcarComDeterministico(
  pdfBytes: Uint8Array,
  resultadoIA: ExtracaoResultado,
): Promise<ExtracaoEnriquecida> {
  const nfes: NFeParsed[] = [];
  const boletos: BoletoParsed[] = [];
  const guias: GuiaParsed[] = [];

  try {
    const paginas = await extrairTextoPorPagina(pdfBytes);
    for (const p of paginas) {
      const txt = normalizarTexto(p.texto);
      const nfe = parseNFe(txt, p.numero);
      if (nfe) nfes.push(nfe);
      const bol = parseBoleto(txt, p.numero);
      if (bol) boletos.push(bol);
      const g = parseGuia(txt, p.numero);
      if (g) guias.push(g);
    }
  } catch (e) {
    console.warn("[pipeline] falha extraindo texto do PDF, seguindo apenas com IA", e);
  }

  const nfeUsado = new Set<number>();
  const boletoUsado = new Set<number>();
  const guiaUsado = new Set<number>();

  const despesas: DespesaEnriquecida[] = resultadoIA.despesas.map((d) => {
    let enriquecida: DespesaEnriquecida = { ...d, origem: "ia" };

    const idxNF = nfes.findIndex(
      (n, i) =>
        !nfeUsado.has(i) && n.valor != null && Math.abs(n.valor - d.valor) <= TOLERANCIA,
    );
    if (idxNF >= 0) {
      nfeUsado.add(idxNF);
      const n = nfes[idxNF];
      enriquecida = {
        ...d,
        nrDocFav: n.cnpjEmit,
        tpDocFav: "CNPJ",
        documento: n.numeroNF,
        valor: n.valor ?? d.valor,
        tipoDocumento: 1,
        origem: "nfe-chave",
        evidencia: `Pág ${n.paginaInicial} — chave NF-e ${n.chave.slice(0, 8)}…${n.chave.slice(-4)}`,
      };
    } else {
      const idxBol = boletos.findIndex(
        (b, i) => !boletoUsado.has(i) && Math.abs(b.valor - d.valor) <= TOLERANCIA,
      );
      if (idxBol >= 0) {
        boletoUsado.add(idxBol);
        const b = boletos[idxBol];
        enriquecida = {
          ...d,
          valor: b.valor,
          origem: "boleto-linha",
          evidencia: `Pág ${b.paginaInicial} — boleto banco ${b.banco}, linha ${b.linhaDigitavel.slice(0, 6)}…${b.linhaDigitavel.slice(-4)}`,
        };
      } else {
        const idxG = guias.findIndex(
          (g, i) => !guiaUsado.has(i) && Math.abs(g.valor - d.valor) <= TOLERANCIA,
        );
        if (idxG >= 0) {
          guiaUsado.add(idxG);
          const g = guias[idxG];
          enriquecida = {
            ...d,
            valor: g.valor,
            origem: "guia-linha",
            evidencia: `Pág ${g.paginaInicial} — guia ${g.tipo} (seg ${g.segmento}), linha ${g.linhaDigitavel.slice(0, 6)}…${g.linhaDigitavel.slice(-4)}`,
          };
        }
      }
    }

    // Fase 6: favorecido padrão (DARF/GPS/GFIP/Sanepar/Copel).
    const { despesa: comOverride, ajuste } = aplicarFavorecidoPadrao(enriquecida);
    if (ajuste.aplicado) {
      const evidenciaPrev = enriquecida.evidencia ? `${enriquecida.evidencia} · ` : "";
      return {
        ...enriquecida,
        ...comOverride,
        origem: enriquecida.origem === "ia" ? "favorecido-padrao" : enriquecida.origem,
        evidencia: `${evidenciaPrev}favorecido padrão: ${ajuste.motivo}`,
      };
    }
    return enriquecida;
  });

  return { ...resultadoIA, despesas };
}
