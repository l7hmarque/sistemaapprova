/**
 * Regras opcionais aplicadas no cliente, no topo do que a IA + pipeline determinístico
 * retornaram. Não muda backend/schema.
 */
import type { ExtracaoResultado, DespesaExtraida } from "./extract/schema";

export type FavorecidoExtra = { chave: string; cnpj: string; nome: string };

export type RegrasUsuario = {
  mesReferenciaForcado: string; // "" = não força
  categoriaPadrao: string; // código (ex: 3.3.90.30.99)
  tipoDocumentoPadrao: number; // ex: 1
  prefixoIdInterno: string; // ex: "ext-"
  favorecidosExtras: FavorecidoExtra[];
};

export const REGRAS_DEFAULT: RegrasUsuario = {
  mesReferenciaForcado: "",
  categoriaPadrao: "",
  tipoDocumentoPadrao: 1,
  prefixoIdInterno: "ext-",
  favorecidosExtras: [],
};

const KEY = "sit-regras-v1";

export function loadRegras(): RegrasUsuario {
  if (typeof window === "undefined") return REGRAS_DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return REGRAS_DEFAULT;
    return { ...REGRAS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return REGRAS_DEFAULT;
  }
}

export function saveRegras(r: RegrasUsuario) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* noop */ }
}

/**
 * Parse de textarea: "chave => CNPJ;Nome" por linha.
 */
export function parseFavorecidosExtras(texto: string): FavorecidoExtra[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.+?)\s*=>\s*([\d./-]+)\s*;\s*(.+)$/);
      if (!m) return null;
      return {
        chave: m[1].trim().toLowerCase(),
        cnpj: m[2].replace(/\D/g, ""),
        nome: m[3].trim(),
      };
    })
    .filter((x): x is FavorecidoExtra => !!x);
}

export function favorecidosExtrasToText(arr: FavorecidoExtra[]): string {
  return arr.map((f) => `${f.chave} => ${f.cnpj};${f.nome}`).join("\n");
}

export function aplicarRegrasUsuario(
  ex: ExtracaoResultado,
  regras: RegrasUsuario,
  contadorInicial = 0,
): { extracao: ExtracaoResultado; proximoContador: number } {
  let contador = contadorInicial;
  const despesas: DespesaExtraida[] = (ex.despesas ?? []).map((d) => {
    let out: DespesaExtraida = { ...d };

    // Favorecidos extras (override por chave no nome do favorecido ou descrição)
    const hay = `${d.favorecido} ${d.descricao}`.toLowerCase();
    for (const f of regras.favorecidosExtras) {
      if (f.chave && hay.includes(f.chave)) {
        out = {
          ...out,
          favorecido: f.nome,
          nrDocFav: f.cnpj,
          tpDocFav: "CNPJ",
        };
        break;
      }
    }

    // Categoria padrão se IA não sugerir
    if (regras.categoriaPadrao && (!out.sugestaoCategoria || out.sugestaoCategoria.trim() === "")) {
      out = { ...out, sugestaoCategoria: regras.categoriaPadrao };
    }

    // Tipo de documento padrão se vier inválido
    if ((!out.tipoDocumento || out.tipoDocumento < 1) && regras.tipoDocumentoPadrao) {
      out = { ...out, tipoDocumento: regras.tipoDocumentoPadrao };
    }

    // Prefixo idInterno
    if (!out.idInterno || /^ext-?\d*$/i.test(out.idInterno) || out.idInterno.trim() === "") {
      contador += 1;
      out = { ...out, idInterno: `${regras.prefixoIdInterno}${contador}` };
    }

    return out;
  });

  return {
    extracao: {
      ...ex,
      mesReferencia: regras.mesReferenciaForcado || ex.mesReferencia,
      despesas,
    },
    proximoContador: contador,
  };
}
