// Extração de texto por página usando unpdf (Worker-compatível).
import { extractText, getDocumentProxy } from "unpdf";

export type PaginaTexto = {
  numero: number; // 1-indexed
  texto: string;
};

export async function extrairTextoPorPagina(
  pdfBytes: Uint8Array,
): Promise<PaginaTexto[]> {
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const arr = Array.isArray(text) ? text : [text];
  return arr.map((t, i) => ({ numero: i + 1, texto: t ?? "" }));
}

/** Normaliza espaços/quebras para regex robustas. */
export function normalizarTexto(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ");
}
