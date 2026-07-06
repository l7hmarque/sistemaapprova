/**
 * Matcher/aplicador de regras de despesa configuradas por organização.
 *
 * Cada regra define condições de match (REO, tipo de documento, regex sobre
 * favorecido) e defaults a aplicar. As regras são iteradas em ordem de
 * prioridade ascendente; cada default **só preenche campos vazios** — nunca
 * sobrescreve valor já definido pelo usuário ou por regra anterior.
 */

export type RegraDespesa = {
  id: string;
  nome: string;
  prioridade: number;
  ativo: boolean;
  match_tp_despesa: number | null;
  match_tp_documento: number | null;
  match_favorecido_regex: string | null;
  set_cd_modalidade: number | null;
  set_tp_documento_pagamento: number | null;
  set_tp_documento_favorecido: string | null;
  set_nr_documento_favorecido: string | null;
  set_nm_favorecido: string | null;
  set_tp_despesa: number | null;
};

export type CamposDespesa = {
  tp_despesa: number | null;
  tp_documento_despesa: number | null;
  cd_modalidade_compra: number | null;
  tp_documento_pagamento: number | null;
  tp_doc_fav: string | null;
  nr_doc_fav: string | null;
  nm_favorecido: string | null;
};

function bate(regra: RegraDespesa, e: CamposDespesa): boolean {
  if (regra.match_tp_despesa != null && e.tp_despesa !== regra.match_tp_despesa) return false;
  if (regra.match_tp_documento != null && e.tp_documento_despesa !== regra.match_tp_documento) return false;
  if (regra.match_favorecido_regex) {
    try {
      const re = new RegExp(regra.match_favorecido_regex, "i");
      if (!re.test(e.nm_favorecido ?? "")) return false;
    } catch {
      return false;
    }
  }
  // Se nenhum critério foi informado, a regra não bate — evita sobrescrever tudo por descuido.
  if (
    regra.match_tp_despesa == null &&
    regra.match_tp_documento == null &&
    !regra.match_favorecido_regex
  ) {
    return false;
  }
  return true;
}

export function aplicarRegrasDespesa<T extends CamposDespesa>(
  evento: T,
  regras: RegraDespesa[],
): { evento: T; aplicadas: string[] } {
  const ordenadas = regras
    .filter((r) => r.ativo)
    .slice()
    .sort((a, b) => a.prioridade - b.prioridade);

  const out: T = { ...evento };
  const aplicadas: string[] = [];

  for (const r of ordenadas) {
    if (!bate(r, out)) continue;
    let mudou = false;
    if (r.set_tp_despesa != null && out.tp_despesa == null) {
      out.tp_despesa = r.set_tp_despesa;
      mudou = true;
    }
    if (r.set_cd_modalidade != null && out.cd_modalidade_compra == null) {
      out.cd_modalidade_compra = r.set_cd_modalidade;
      mudou = true;
    }
    if (r.set_tp_documento_pagamento != null && out.tp_documento_pagamento == null) {
      out.tp_documento_pagamento = r.set_tp_documento_pagamento;
      mudou = true;
    }
    if (r.set_tp_documento_favorecido && !out.tp_doc_fav) {
      out.tp_doc_fav = r.set_tp_documento_favorecido;
      mudou = true;
    }
    if (r.set_nr_documento_favorecido && !out.nr_doc_fav) {
      out.nr_doc_fav = r.set_nr_documento_favorecido.replace(/\D/g, "") || r.set_nr_documento_favorecido;
      mudou = true;
    }
    if (r.set_nm_favorecido && !out.nm_favorecido) {
      out.nm_favorecido = r.set_nm_favorecido;
      mudou = true;
    }
    if (mudou) aplicadas.push(r.nome);
  }

  return { evento: out, aplicadas };
}
