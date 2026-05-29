/**
 * Pipeline determinística que reforça a extração da IA.
 *
 * Estratégia:
 *  1. Extrai texto por página com unpdf.
 *  2. Em cada página: coleta TODAS as NF-e (44d), boletos (47d) e guias (48d).
 *  3. Para cada despesa retornada pela IA, tenta casar pelo valor (±0,01).
 *     Se houver mais de um candidato com o mesmo valor para o mesmo tipo,
 *     o override é PULADO (ambiguidade) — preserva o que a IA extraiu.
 *  4. Aplica overrides de favorecidos padrão (DARF/GPS/GFIP/Sanepar/Copel).
 */
import type { ExtracaoResultado, DespesaExtraida } from "./schema";
import { extrairTextoPorPagina, normalizarTexto } from "./pdfText";
import { parseNFeAll, type NFeParsed } from "./parsers/nfe";
import { parseBoletoAll, type BoletoParsed } from "./parsers/boleto";
import { parseGuiaAll, type GuiaParsed } from "./parsers/guia";
import { aplicarFavorecidoPadrao, carregarFavorecidos } from "./favorecidosPadrao";

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

type Used = Set<number>;

function buscarUnico<T extends { valor: number | null }>(
  arr: T[],
  used: Used,
  valor: number,
): { idx: number; item: T } | { ambiguo: true } | null {
  const candidatos: number[] = [];
  arr.forEach((it, i) => {
    if (used.has(i)) return;
    if (it.valor == null) return;
    if (Math.abs(it.valor - valor) <= TOLERANCIA) candidatos.push(i);
  });
  if (candidatos.length === 0) return null;
  if (candidatos.length > 1) return { ambiguo: true };
  return { idx: candidatos[0], item: arr[candidatos[0]] };
}

export async function reforcarComDeterministico(
  pdfBytes: Uint8Array,
  resultadoIA: ExtracaoResultado,
): Promise<ExtracaoEnriquecida> {
  const nfes: NFeParsed[] = [];
  const boletos: BoletoParsed[] = [];
  const guias: GuiaParsed[] = [];

  try {
    // Timeout defensivo: se unpdf travar no runtime do Worker, não bloqueia o retorno.
    const paginas = await Promise.race([
      extrairTextoPorPagina(pdfBytes),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("pdf-text timeout (10s)")), 10_000),
      ),
    ]);
    for (const p of paginas) {
      const txt = normalizarTexto(p.texto);
      nfes.push(...parseNFeAll(txt, p.numero));
      boletos.push(...parseBoletoAll(txt, p.numero));
      guias.push(...parseGuiaAll(txt, p.numero));
    }
    console.info(
      `[pipeline] texto extraído: ${nfes.length} NF-e, ${boletos.length} boletos, ${guias.length} guias`,
    );
  } catch (e) {
    console.warn("[pipeline] falha extraindo texto do PDF, seguindo apenas com IA", e);
  }

  const nfeUsado: Used = new Set();
  const boletoUsado: Used = new Set();
  const guiaUsado: Used = new Set();

  const despesas: DespesaEnriquecida[] = resultadoIA.despesas.map((d) => {
    let enriquecida: DespesaEnriquecida = { ...d, origem: "ia" };

    // Ordem: NF-e (mais específico/CNPJ validado) → boleto → guia.
    const nf = buscarUnico(nfes, nfeUsado, d.valor);
    if (nf && !("ambiguo" in nf)) {
      nfeUsado.add(nf.idx);
      const n = nf.item;
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
      const bol = buscarUnico(boletos, boletoUsado, d.valor);
      if (bol && !("ambiguo" in bol)) {
        boletoUsado.add(bol.idx);
        const b = bol.item;
        enriquecida = {
          ...d,
          valor: b.valor,
          origem: "boleto-linha",
          evidencia: `Pág ${b.paginaInicial} — boleto banco ${b.banco}, linha ${b.linhaDigitavel.slice(0, 6)}…${b.linhaDigitavel.slice(-4)}`,
        };
      } else {
        const g = buscarUnico(guias, guiaUsado, d.valor);
        if (g && !("ambiguo" in g)) {
          guiaUsado.add(g.idx);
          const it = g.item;
          enriquecida = {
            ...d,
            valor: it.valor,
            origem: "guia-linha",
            evidencia: `Pág ${it.paginaInicial} — guia ${it.tipo} (seg ${it.segmento}), linha ${it.linhaDigitavel.slice(0, 6)}…${it.linhaDigitavel.slice(-4)}`,
          };
        } else if (
          (nf && "ambiguo" in nf) ||
          (bol && "ambiguo" in bol) ||
          (g && "ambiguo" in g)
        ) {
          console.info(
            `[pipeline] override pulado por ambiguidade de valor (R$ ${d.valor.toFixed(2)} — ${d.favorecido})`,
          );
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
