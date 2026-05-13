/**
 * Validação oficial de CNPJ (algoritmo dos 2 dígitos verificadores).
 * Aceita string com ou sem máscara. Rejeita strings com todos os dígitos iguais.
 */
export function isValidCNPJ(input: string | null | undefined): boolean {
  if (!input) return false;
  const c = String(input).replace(/\D/g, "");
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;

  const calcDV = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];

  const dv1 = calcDV(c.slice(0, 12), w1);
  if (dv1 !== Number(c[12])) return false;
  const dv2 = calcDV(c.slice(0, 13), w2);
  if (dv2 !== Number(c[13])) return false;
  return true;
}

export function isValidCPF(input: string | null | undefined): boolean {
  if (!input) return false;
  const c = String(input).replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const dv = (len: number): number => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
