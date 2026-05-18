// Extrai texto de um PDF no browser usando pdfjs-dist.
// Retorna o texto concatenado (páginas separadas por \n\n).
// Lança em caso de PDF inválido/corrompido.

import * as pdfjsLib from "pdfjs-dist";
// Worker via URL do bundler (Vite resolve para um asset servido).
// @ts-expect-error - import de worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configura uma vez
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as string;
}

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const partes: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const txt = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    partes.push(txt);
  }
  await pdf.destroy();
  return partes.join("\n\n").trim();
}
