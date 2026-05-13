import { describe, expect, it } from "vitest";
import { isValidCNPJ, isValidCPF } from "./cnpjValidator";

describe("isValidCNPJ", () => {
  it("aceita CNPJs reais", () => {
    expect(isValidCNPJ("76.484.013/0001-45")).toBe(true); // Sanepar
    expect(isValidCNPJ("77945152000191")).toBe(true);
    expect(isValidCNPJ("00.394.460/0001-41")).toBe(true);
  });
  it("rejeita checksum errado", () => {
    expect(isValidCNPJ("76484013000146")).toBe(false);
    expect(isValidCNPJ("12345678000100")).toBe(false);
  });
  it("rejeita formato inválido", () => {
    expect(isValidCNPJ("")).toBe(false);
    expect(isValidCNPJ("123")).toBe(false);
    expect(isValidCNPJ("00000000000000")).toBe(false);
    expect(isValidCNPJ(null)).toBe(false);
  });
});

describe("isValidCPF", () => {
  it("valida e rejeita corretamente", () => {
    expect(isValidCPF("11144477735")).toBe(true);
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("12345678900")).toBe(false);
  });
});
