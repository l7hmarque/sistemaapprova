import { describe, expect, it } from "vitest";
import { formatLinhaSIT } from "./formatLinha";

describe("formatLinhaSIT", () => {
  const base = {
    dtDespesa: "2025-04-15",
    vlDespesa: "1.250,50",
    cdTipoDocumentoDespesa: 1,
    cdSubtipoDocumentoDespesa: null,
    nrDocumentoDespesa: "NF 123",
    dtEmissaoDocumentoDespesa: "2025-04-10",
    tpDocumentoFavorecido: "CNPJ" as const,
    nrDocumentoFavorecido: "12.345.678/0001-99",
    nmFavorecido: "Açaí Comércio Ltda",
    dsObjetoDespesa: "Compra de gêneros alimentícios",
  };

  it("formata 12 campos terminando com pipe", () => {
    const out = formatLinhaSIT(base, 1, 100);
    expect(out.endsWith("|")).toBe(true);
    expect(out.split("|").length - 1).toBe(12);
  });

  it("converte valor brasileiro para 0.00", () => {
    const out = formatLinhaSIT(base, 1, 100);
    expect(out.split("|")[3]).toBe("1250.50");
  });

  it("remove acentos, pipes e aspas dos textos", () => {
    const dirty = {
      ...base,
      nmFavorecido: 'João "Pipe|Co"',
      dsObjetoDespesa: "Linha\ncom\rquebras|e \\barras",
    };
    const out = formatLinhaSIT(dirty, 2, 200);
    const parts = out.split("|");
    expect(parts[10]).toBe("Joao  Pipe Co");
    expect(parts[11]).toMatch(/^Linha com quebras e  barras$/);
  });

  it("mantém apenas dígitos no nrDocumentoFavorecido", () => {
    const out = formatLinhaSIT(base, 1, 100);
    expect(out.split("|")[9]).toBe("12345678000199");
  });

  it("trunca nmFavorecido em 100 e dsObjetoDespesa em 1000", () => {
    const long = {
      ...base,
      nmFavorecido: "A".repeat(150),
      dsObjetoDespesa: "B".repeat(1500),
    };
    const out = formatLinhaSIT(long, 1, 1);
    const parts = out.split("|");
    expect(parts[10].length).toBe(100);
    expect(parts[11].length).toBe(1000);
  });

  it("override DARF (tipo 4 / subtipo 7)", () => {
    const out = formatLinhaSIT(
      {
        ...base,
        cdTipoDocumentoDespesa: 4,
        cdSubtipoDocumentoDespesa: 7,
        nrDocumentoFavorecido: "00.000.000/0000-00",
        nmFavorecido: "Qualquer",
      },
      1,
      1,
    );
    const parts = out.split("|");
    expect(parts[9]).toBe("00394460000141");
    expect(parts[10]).toBe("Ministerio da Fazenda");
  });

  it("override GPS (tipo 4 / subtipo 9)", () => {
    const out = formatLinhaSIT(
      { ...base, cdTipoDocumentoDespesa: 4, cdSubtipoDocumentoDespesa: 9 },
      1,
      1,
    );
    const parts = out.split("|");
    expect(parts[9]).toBe("16727230000197");
    expect(parts[10]).toBe("Fundo do Regime Geral de Previdencia Social");
  });

  it("override GFIP (tipo 4 / subtipo 10)", () => {
    const out = formatLinhaSIT(
      { ...base, cdTipoDocumentoDespesa: 4, cdSubtipoDocumentoDespesa: 10 },
      1,
      1,
    );
    const parts = out.split("|");
    expect(parts[9]).toBe("00360305000104");
    expect(parts[10]).toBe("Caixa Economica Federal");
  });

  it("subtipo vazio resulta em || consecutivo", () => {
    const out = formatLinhaSIT(base, 1, 1);
    expect(out).toContain("|1|");
    const parts = out.split("|");
    expect(parts[5]).toBe("");
  });
});
