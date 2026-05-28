/**
 * Validação de dígitos verificadores de CPF e CNPJ.
 * Algoritmo oficial da Receita Federal.
 */

export function validarCPF(input: string | null | undefined): boolean {
  if (!input) return false;
  const cpf = String(input).replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const calc = (slice: string, factor: number) => {
    let sum = 0;
    for (const c of slice) sum += parseInt(c, 10) * factor--;
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

export function validarCNPJ(input: string | null | undefined): boolean {
  if (!input) return false;
  const cnpj = String(input).replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (slice: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(slice[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 13), w2);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

/** Valida nº doc favorecido conforme tp_doc_fav (CPF/CNPJ/EXT). */
export function validarDocFavorecido(
  tipo: string | null | undefined,
  numero: string | null | undefined,
): { ok: boolean; motivo?: string } {
  if (!tipo || !numero) return { ok: false, motivo: "vazio" };
  const t = String(tipo).toUpperCase();
  const n = String(numero).replace(/\D/g, "");
  if (t === "CPF") {
    if (!validarCPF(n)) return { ok: false, motivo: "CPF inválido" };
  } else if (t === "CNPJ") {
    if (!validarCNPJ(n)) return { ok: false, motivo: "CNPJ inválido" };
  } else if (t === "EXT") {
    if (n.length < 4) return { ok: false, motivo: "doc estrangeiro muito curto" };
  } else {
    return { ok: false, motivo: "tipo desconhecido" };
  }
  return { ok: true };
}
