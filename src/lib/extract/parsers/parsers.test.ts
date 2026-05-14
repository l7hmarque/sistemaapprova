import { describe, expect, it } from "vitest";
import { parseNFe } from "./nfe";
import { parseBoleto } from "./boleto";

describe("parseNFe", () => {
  it("extrai CNPJ emitente, número e valor a partir da chave + 'VALOR TOTAL'", () => {
    // chave válida: usa CNPJ Sanepar (76484013000145) como emit, AAMM=2504, nNF=000000123
    // mod=55 serie=001 tpEmis=1 cNF=00000001 cDV=0 (cDV não validado pelo parser)
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
    // valor = 12345 / 100 = 123.45 ; fator = 10000 → 07/10/1997 + 10000d
    const linha = "00190000090000000000000000000000010000000012345";
    expect(linha.length).toBe(47);
    // formata um pouco para parecer com PDF
    const formatada = `${linha.slice(0,5)}.${linha.slice(5,10)} ${linha.slice(10,15)}.${linha.slice(15,21)} ${linha.slice(21,26)}.${linha.slice(26,32)} ${linha.slice(32,33)} ${linha.slice(33,47)}`;
    const r = parseBoleto(`pague o boleto ${formatada} no banco`, 2);
    expect(r).toBeTruthy();
    expect(r!.banco).toBe("001");
    expect(r!.valor).toBe(123.45);
    expect(r!.vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
