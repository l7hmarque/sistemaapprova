import { describe, expect, it } from "vitest";
import { parseNFe } from "./nfe";
import { parseBoleto } from "./boleto";
import { parseGuia, parseGuiaAll } from "./guia";

describe("parseNFe", () => {
  it("extrai CNPJ emitente, número e valor a partir da chave + 'VALOR TOTAL'", () => {
    const chave = "41" + "2504" + "76484013000145" + "55" + "001" + "000000123" + "1" + "00000001" + "0";
    const txt = `Algum cabecalho ${chave} VALOR TOTAL DA NOTA R$ 1.234,56 final`;
    const r = parseNFe(txt, 3);
    expect(r).toBeTruthy();
    expect(r!.cnpjEmit).toBe("76484013000145");
    expect(r!.numeroNF).toBe("123");
    expect(r!.valor).toBe(1234.56);
    expect(r!.paginaInicial).toBe(3);
  });

  it("retorna null quando CNPJ embutido é inválido", () => {
    const chave = "41250400000000000000550010000001231000000010";
    expect(parseNFe(`x ${chave} y`, 1)).toBeNull();
  });
});

describe("parseBoleto", () => {
  it("extrai banco, valor e vencimento da linha digitável", () => {
    const linha = "00190000090000000000000000000000010000000012345";
    expect(linha.length).toBe(47);
    const formatada = `${linha.slice(0,5)}.${linha.slice(5,10)} ${linha.slice(10,15)}.${linha.slice(15,21)} ${linha.slice(21,26)}.${linha.slice(26,32)} ${linha.slice(32,33)} ${linha.slice(33,47)}`;
    const r = parseBoleto(`pague o boleto ${formatada} no banco`, 2);
    expect(r).toBeTruthy();
    expect(r!.banco).toBe("001");
    expect(r!.valor).toBe(123.45);
    expect(r!.vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseGuia", () => {
  // Helper: monta uma linha digitável de 48 dígitos com valor controlado.
  // pos 0..2 = '8' + segmento + tipoValor(7); valor = 11 dígitos em pos 4..14.
  function montarGuia(valorCent: number, segmento = "5"): string {
    const valorStr = String(valorCent).padStart(11, "0");
    const head = "8" + segmento + "7" + "0" + valorStr; // 15 chars
    const restante = "0".repeat(48 - head.length);
    return head + restante;
  }

  it("extrai uma guia DARF válida", () => {
    const linha = montarGuia(1234567); // R$ 12.345,67
    const r = parseGuia(`DARF ${linha} pagamento`, 4);
    expect(r).toBeTruthy();
    expect(r!.valor).toBeCloseTo(12345.67, 2);
    expect(r!.tipo).toBe("DARF");
    expect(r!.linhaDigitavel).toHaveLength(48);
  });

  it("não confunde com chave NF-e de 44 dígitos próxima", () => {
    const chave44 = "8".padEnd(44, "1");
    expect(parseGuia(`x ${chave44} y`, 1)).toBeNull();
  });

  it("rejeita sequência de 50 dígitos começando com 8", () => {
    const linha50 = "8" + "1".repeat(49);
    expect(parseGuia(`x ${linha50} y`, 1)).toBeNull();
  });

  it("parseGuiaAll retorna todas as guias da página", () => {
    const a = montarGuia(50000); // R$ 500,00
    const b = montarGuia(75000, "6"); // R$ 750,00
    const r = parseGuiaAll(`GPS ${a} e tambem DARF ${b}`, 2);
    expect(r).toHaveLength(2);
    const valores = r.map((g) => g.valor).sort();
    expect(valores).toEqual([500, 750]);
  });
});
