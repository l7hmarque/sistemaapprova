/**
 * Função de formatação da linha do arquivo Despesa.txt no padrão SIT (TCE-PR).
 *
 * Saída: 12 campos concatenados por pipe (|), terminando obrigatoriamente com
 * pipe. Campos vazios viram "||".
 *
 * Ordem dos campos:
 *  1. nrLinha
 *  2. idDespesa
 *  3. dtDespesa                     (AAAA-MM-DD)
 *  4. vlDespesa                     (0.00)
 *  5. cdTipoDocumentoDespesa
 *  6. cdSubtipoDocumentoDespesa     (opcional)
 *  7. nrDocumentoDespesa
 *  8. dtEmissaoDocumentoDespesa     (AAAA-MM-DD)
 *  9. tpDocumentoFavorecido         (CPF | CNPJ | EXT)
 * 10. nrDocumentoFavorecido         (apenas dígitos)
 * 11. nmFavorecido                  (≤ 100 chars, sem acentos/pipes)
 * 12. dsObjetoDespesa               (≤ 1000 chars, sem acentos/pipes)
 */

export type DespesaInput = {
  dtDespesa: string;
  vlDespesa: string | number;
  cdTipoDocumentoDespesa: number;
  cdSubtipoDocumentoDespesa?: number | null;
  nrDocumentoDespesa: string;
  dtEmissaoDocumentoDespesa: string;
  tpDocumentoFavorecido: "CPF" | "CNPJ" | "EXT" | string;
  nrDocumentoFavorecido: string;
  nmFavorecido: string;
  dsObjetoDespesa: string;
};

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const stripUnsafe = (s: string) =>
  s.replace(/[|"'\\\r\n]/g, " ").replace(/\s+/g, " ").trim();

const cleanText = (s: string) => stripDiacritics(stripUnsafe(s ?? ""));

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

const toDecimal = (v: string | number): string => {
  if (typeof v === "number") return v.toFixed(2);
  const cleaned = String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  if (!isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) : s;

/** CNPJs/órgãos forçados quando cdTipoDocumentoDespesa === 4 (Guia). */
const GUIA_OVERRIDES: Record<number, { cnpj: string; nome: string }> = {
  7: { cnpj: "00394460000141", nome: "Ministerio da Fazenda" },
  9: {
    cnpj: "16727230000197",
    nome: "Fundo do Regime Geral de Previdencia Social",
  },
  10: { cnpj: "00360305000104", nome: "Caixa Economica Federal" },
};

export function formatLinhaSIT(
  input: DespesaInput,
  nrLinha: number,
  idDespesa: number | string,
): string {
  let nrDocFav = onlyDigits(input.nrDocumentoFavorecido);
  let nmFav = cleanText(input.nmFavorecido);
  const vl = toDecimal(input.vlDespesa);
  const cdTipo = input.cdTipoDocumentoDespesa;
  const cdSub = input.cdSubtipoDocumentoDespesa;

  if (cdTipo === 4 && cdSub != null && GUIA_OVERRIDES[cdSub]) {
    nrDocFav = GUIA_OVERRIDES[cdSub].cnpj;
    nmFav = GUIA_OVERRIDES[cdSub].nome;
  }

  nmFav = truncate(nmFav, 100);
  const dsObj = truncate(cleanText(input.dsObjetoDespesa), 1000);
  const nrDoc = cleanText(input.nrDocumentoDespesa);

  const campos = [
    String(nrLinha),
    String(idDespesa),
    input.dtDespesa ?? "",
    vl,
    cdTipo != null ? String(cdTipo) : "",
    cdSub != null ? String(cdSub) : "",
    nrDoc,
    input.dtEmissaoDocumentoDespesa ?? "",
    input.tpDocumentoFavorecido ?? "",
    nrDocFav,
    nmFav,
    dsObj,
  ];

  return campos.join("|") + "|";
}
