import type { ExtracaoResultado } from "@/lib/extract/schema";

/**
 * Regras da aba `regrasHolerite` (planilha de referência da entidade):
 * - Para despesas de Vencimentos e Salários (categoria 3.1.90.11.01):
 *   - documento = "MM/AA", onde MM = mês_referência - 1 e AA = últimos 2 dígitos do ano.
 *   - dataEmissao = último dia de (mês_referência - 2), no ano correspondente.
 * Aplicada server-side, logo após o parse Zod, antes de qualquer tabela ou geração do .txt SIT.
 */
export function aplicarRegrasHolerite(extracao: ExtracaoResultado): ExtracaoResultado {
  const m = extracao.mesReferencia.match(/(\d{1,2})\/(\d{4})/);
  if (!m) return extracao;
  const mm = Number(m[1]);
  const aaaa = Number(m[2]);

  // Documento: MM = mês anterior, AA = últimos 2 dígitos do ano correspondente.
  let mDoc = mm - 1;
  let yDoc = aaaa;
  if (mDoc <= 0) {
    mDoc += 12;
    yDoc -= 1;
  }
  const documento = `${String(mDoc).padStart(2, "0")}/${String(yDoc % 100).padStart(2, "0")}`;

  // dataEmissao: MM = mês_ref - 2, DD = último dia, AAAA = ano correspondente.
  let mEm = mm - 2;
  let yEm = aaaa;
  if (mEm <= 0) {
    mEm += 12;
    yEm -= 1;
  }
  const ultimoDia = new Date(yEm, mEm, 0).getDate();
  const dataEmissao = `${yEm}-${String(mEm).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  const despesas = extracao.despesas.map((d) =>
    d.sugestaoCategoria === "3.1.90.11.01" ? { ...d, documento, dataEmissao } : d,
  );
  return { ...extracao, despesas };
}
