import { describe, expect, it } from "vitest";
import { formatLinhaSIT, type DadosTermo, type DespesaInput } from "./formatLinha";

const termo: DadosTermo = {
  nrCNPJConcedente: "76.206.481/0001-58",
  tpTransferencia: 1,
  nrInternoConcedente: "001/2022",
  anoTransferencia: 2026,
};

const base: DespesaInput = {
  tpDespesa: 60,
  tpDocumentoFavorecido: "CNPJ",
  nrDocumentoFavorecido: "12.345.678/0001-99",
  nmFavorecido: "Açaí Comércio Ltda",
  tpDocumentoDespesa: 1,
  nrDocumentoDespesa: "NF 123",
  vlDocumentoDespesa: "1.250,50",
  dtDocumentoDespesa: "2025-04-15",
  cdModalidadeCompra: 8,
  tpDocumentoPagamento: 6,
  nrDocumentoPagamento: "123",
  dtEmissaoPagamento: "2025-04-15",
  dtDebito: null,
  dsItemDespesa: "Compra de gêneros alimentícios",
};

describe("formatLinhaSIT", () => {
  it("gera exatamente 24 campos sem pipe final", () => {
    const out = formatLinhaSIT(termo, base);
    expect(out.endsWith("|")).toBe(false);
    expect(out.split("|").length).toBe(24);
  });

  it("CNPJ do concedente vira só dígitos", () => {
    const out = formatLinhaSIT(termo, base);
    expect(out.split("|")[0]).toBe("76206481000158");
  });

  it("converte valor brasileiro para 0.00", () => {
    const out = formatLinhaSIT(termo, base);
    expect(out.split("|")[10]).toBe("1250.50");
  });

  it("datas em DD-MM-AAAA", () => {
    const out = formatLinhaSIT(termo, base);
    const parts = out.split("|");
    expect(parts[11]).toBe("15-04-2025"); // dtDocumentoDespesa
    expect(parts[21]).toBe("15-04-2025"); // dtEmissaoPagamento
  });

  it("remove acentos, pipes e aspas dos textos", () => {
    const out = formatLinhaSIT(termo, {
      ...base,
      nmFavorecido: 'João "Pipe|Co"',
      dsItemDespesa: "Linha\ncom\rquebras|e \\barras",
    });
    const parts = out.split("|");
    expect(parts[7]).toBe("Joao Pipe Co");
    expect(parts[23]).toBe("Linha com quebras e barras");
  });

  it("override DARF (tpDocumentoDespesa = 7)", () => {
    const out = formatLinhaSIT(termo, {
      ...base,
      tpDocumentoDespesa: 7,
      nrDocumentoFavorecido: "00.000.000/0000-00",
      nmFavorecido: "Qualquer",
    });
    const parts = out.split("|");
    expect(parts[6]).toBe("00394460000141");
    expect(parts[7]).toBe("MINISTERIO DA FAZENDA - MATRIZ");
  });

  it("override GPS (tpDocumentoDespesa = 9)", () => {
    const out = formatLinhaSIT(termo, { ...base, tpDocumentoDespesa: 9 });
    const parts = out.split("|");
    expect(parts[6]).toBe("16727230000197");
    expect(parts[7]).toBe("FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL");
  });

  it("override GFIP (tpDocumentoDespesa = 10)", () => {
    const out = formatLinhaSIT(termo, { ...base, tpDocumentoDespesa: 10 });
    const parts = out.split("|");
    expect(parts[6]).toBe("00360305000104");
    expect(parts[7]).toBe("CAIXA ECONOMICA FEDERAL");
  });

  it("placa e km de veículo ficam vazios", () => {
    const out = formatLinhaSIT(termo, base);
    const parts = out.split("|");
    expect(parts[12]).toBe("");
    expect(parts[13]).toBe("");
  });
});
