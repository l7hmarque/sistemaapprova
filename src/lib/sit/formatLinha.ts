/**
 * Formatação da linha do arquivo Despesa.txt no padrão SIT (TCE-PR).
 *
 * 24 campos separados por pipe (|). A linha NÃO termina com pipe — apenas
 * separa os campos. Datas DD-MM-AAAA. Valores 0.00 (ponto). Campos vazios
 * geram separadores consecutivos ("||").
 *
 * Ordem dos campos (conforme PDF de layout v1):
 *  1. nrCNPJConcedente            (14 dígitos)
 *  2. tpTransferencia             (1,5,7,8,9)
 *  3. nrInternoConcedente         (≤20 chars)
 *  4. anoTransferencia            (4 dígitos)
 *  5. tpDespesa                   (Apêndice A item 12)
 *  6. tpDocumentoFavorecido       (CPF | CNPJ | EXT)
 *  7. nrDocumentoFavorecido
 *  8. nmFavorecido                (≤250)
 *  9. tpDocumentoDespesa          (Apêndice A item 16)
 * 10. nrDocumentoDespesa          (≤10)
 * 11. vlDocumentoDespesa          (0.00)
 * 12. dtDocumentoDespesa          (DD-MM-AAAA)
 * 13. dsPlacaVeiculo              (vazio se não veículo)
 * 14. nrQuilometragemVeiculo
 * 15. nrEmpenho
 * 16. dtEmpenho
 * 17. cdModalidadeCompra          (Apêndice A item 17)
 * 18. nrProcessoCompra
 * 19. dtProcessoCompra
 * 20. tpDocumentoPagamento        (Apêndice A item 18)
 * 21. nrDocumentoPagamento        (≤15)
 * 22. dtEmissaoPagamento          (DD-MM-AAAA)
 * 23. dtDebito                    (DD-MM-AAAA, opcional)
 * 24. dsItemDespesa               (≤2000)
 */

import { FAVORECIDO_OVERRIDES } from "./catalogos";

export type DadosTermo = {
  nrCNPJConcedente: string;
  tpTransferencia: number;
  nrInternoConcedente: string;
  anoTransferencia: number;
};

export type DespesaInput = {
  tpDespesa: number | null;
  tpDocumentoFavorecido: "CPF" | "CNPJ" | "EXT" | string;
  nrDocumentoFavorecido: string;
  nmFavorecido: string;
  tpDocumentoDespesa: number;
  nrDocumentoDespesa: string;
  vlDocumentoDespesa: string | number;
  dtDocumentoDespesa: string; // ISO AAAA-MM-DD
  cdModalidadeCompra: number;
  tpDocumentoPagamento: number;
  nrDocumentoPagamento: string;
  dtEmissaoPagamento: string; // ISO
  dtDebito?: string | null;   // ISO
  dsItemDespesa: string;
};

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const stripUnsafe = (s: string) =>
  s.replace(/[|"'\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
const cleanText = (s: string) => stripDiacritics(stripUnsafe(s ?? ""));
const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");
const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

const toDecimal = (v: string | number): string => {
  if (typeof v === "number") return v.toFixed(2);
  const cleaned = String(v ?? "").trim().replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return isFinite(n) ? n.toFixed(2) : "0.00";
};

/** ISO AAAA-MM-DD → DD-MM-AAAA. Aceita também já formatado. */
const toBrDate = (s: string | null | undefined): string => {
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const br = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (br) return `${br[1]}-${br[2]}-${br[3]}`;
  return "";
};

export function formatLinhaSIT(termo: DadosTermo, d: DespesaInput): string {
  let nrDocFav = onlyDigits(d.nrDocumentoFavorecido);
  let nmFav = cleanText(d.nmFavorecido);

  const ovr = FAVORECIDO_OVERRIDES[d.tpDocumentoDespesa];
  if (ovr) {
    nrDocFav = ovr.cnpj;
    nmFav = ovr.nome;
  }

  const campos = [
    onlyDigits(termo.nrCNPJConcedente),                                    // 1
    String(termo.tpTransferencia ?? ""),                                   // 2
    truncate(cleanText(termo.nrInternoConcedente), 20),                    // 3
    String(termo.anoTransferencia ?? ""),                                  // 4
    d.tpDespesa != null ? String(d.tpDespesa) : "",                        // 5
    d.tpDocumentoFavorecido ?? "",                                         // 6
    nrDocFav,                                                              // 7
    truncate(nmFav, 250),                                                  // 8
    String(d.tpDocumentoDespesa ?? ""),                                    // 9
    truncate(cleanText(d.nrDocumentoDespesa), 10),                         // 10
    toDecimal(d.vlDocumentoDespesa),                                       // 11
    toBrDate(d.dtDocumentoDespesa),                                        // 12
    "",                                                                    // 13 dsPlacaVeiculo
    "",                                                                    // 14 nrQuilometragemVeiculo
    "",                                                                    // 15 nrEmpenho
    "",                                                                    // 16 dtEmpenho
    String(d.cdModalidadeCompra ?? ""),                                    // 17
    "",                                                                    // 18 nrProcessoCompra
    "",                                                                    // 19 dtProcessoCompra
    String(d.tpDocumentoPagamento ?? ""),                                  // 20
    truncate(cleanText(d.nrDocumentoPagamento), 15),                       // 21
    toBrDate(d.dtEmissaoPagamento),                                        // 22
    toBrDate(d.dtDebito ?? ""),                                            // 23
    truncate(cleanText(d.dsItemDespesa), 2000),                            // 24
  ];

  return campos.join("|");
}
