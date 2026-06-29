/**
 * Helpers server-only para cotações.
 * Extrai geração de Sheet + export PDF sem depender de Supabase,
 * para ser usado tanto pelo server fn autenticado quanto pelo
 * endpoint público do portal do fornecedor.
 *
 * NUNCA importe este arquivo no cliente.
 */
import {
  ABA_ORC,
  ORC_MODEL,
  TEMPLATE_ORCAMENTO_ID,
  driveCopyFile,
  expandirLinhasItens,
  getFirstSheetId,
  renameSheet,
  sheetsValuesBatchUpdate,
} from "./orcamentos.server";
import { ensureMesFolder } from "./drive-org.server";

export const ENTIDADE_DEFAULT = {
  razao: "Sociedade Civil Nossa Senhora Aparecida",
  cnpj: "01.788.362/0001-51",
  representante: "Raul Oscar Sena Velez",
  cpf: "801.780.489-09",
};

export interface CotacaoSnapshot {
  id: string;
  objeto: string;
  termo: string | null;
  mes_referencia: string | null;
  itens: Array<{ descricao: string; qtd: number; unidade: string }>;
}

export interface FornecedorSnapshot {
  razao: string;
  cnpj: string;
  representante?: string;
  cpf?: string;
}

export interface ModeloAtivo {
  template_id: string;
  aba: string;
  params: Record<string, unknown>;
}

function sanitizarNome(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function safeOrgFolder(orgId: string | undefined, mesRef: string | null | undefined): Promise<string[] | undefined> {
  if (!orgId) return undefined;
  try {
    const id = await ensureMesFolder(orgId, "Orçamentos", mesRef ?? null);
    return id ? [id] : undefined;
  } catch (e) {
    console.warn("ensureMesFolder (Orçamentos) falhou:", e);
    return undefined;
  }
}

export async function criarSheetOrcamentoCotacao(args: {
  cotacao: CotacaoSnapshot;
  fornecedor: FornecedorSnapshot;
  precosUnitarios: number[];
  data: string;
  validadeDias: number;
  modelo?: ModeloAtivo | null;
}): Promise<{ fileId: string; url: string; nome: string; snapshot: any }> {
  const { cotacao: cot, fornecedor, precosUnitarios, data, validadeDias, modelo } = args;

  const itens = cot.itens ?? [];
  if (itens.length !== precosUnitarios.length) {
    throw new Error("Número de preços não bate com os itens.");
  }

  const templateId = modelo?.template_id || TEMPLATE_ORCAMENTO_ID;
  const aba = modelo?.aba || ABA_ORC;
  const M = { ...ORC_MODEL, ...(modelo?.params ?? {}) };

  const parents = await safeFolder(pastaDestino(cot.mes_referencia));
  const nome = sanitizarNome(
    `Orcamento - ${cot.objeto} - ${fornecedor.razao} - ${data || new Date().toLocaleDateString("pt-BR")}`,
  );

  const copy = await driveCopyFile({ templateId, name: nome, parents });
  const { sheetId } = await getFirstSheetId(copy.id);
  try {
    await renameSheet(copy.id, sheetId, aba);
  } catch {
    /* no-op */
  }

  await expandirLinhasItens({
    spreadsheetId: copy.id,
    sheetId,
    linhaPrimeiroItem0: M.linhaPrimeiroItem1 - 1,
    qtdLinhasExistentes: M.qtdLinhasExistentes,
    linhaTotais0: M.linhaTotais1 - 1,
    qtdNecessaria: itens.length,
    colCount: M.colCount,
  });

  const updates: Array<{ range: string; values: (string | number | null)[][] }> = [
    { range: `${aba}!C7`, values: [[ENTIDADE_DEFAULT.razao]] },
    { range: `${aba}!H7`, values: [[ENTIDADE_DEFAULT.representante]] },
    { range: `${aba}!C8`, values: [[ENTIDADE_DEFAULT.cnpj]] },
    { range: `${aba}!H8`, values: [[ENTIDADE_DEFAULT.cpf]] },
    { range: `${aba}!C9`, values: [[fornecedor.razao]] },
    { range: `${aba}!H9`, values: [[fornecedor.representante ?? ""]] },
    { range: `${aba}!C10`, values: [[fornecedor.cnpj]] },
    { range: `${aba}!H10`, values: [[fornecedor.cpf ?? ""]] },
    { range: `${aba}!C11`, values: [[cot.objeto]] },
    { range: `${aba}!I11`, values: [[validadeDias]] },
    { range: `${aba}!K11`, values: [[data || new Date().toLocaleDateString("pt-BR")]] },
    { range: `${aba}!E12`, values: [[cot.termo ?? ""]] },
  ];

  const linha0 = M.linhaPrimeiroItem1;
  itens.forEach((it, i) => {
    const linha = linha0 + i;
    updates.push({ range: `${aba}!A${linha}`, values: [[i + 1]] });
    updates.push({ range: `${aba}!B${linha}`, values: [[it.descricao]] });
    updates.push({ range: `${aba}!H${linha}`, values: [[it.qtd]] });
    updates.push({ range: `${aba}!I${linha}`, values: [[it.unidade]] });
    updates.push({ range: `${aba}!J${linha}`, values: [[precosUnitarios[i] || 0]] });
  });

  await sheetsValuesBatchUpdate(copy.id, updates);

  const snapshot = {
    entidade: ENTIDADE_DEFAULT,
    termo: cot.termo,
    fornecedor,
    objeto: cot.objeto,
    validadeDias,
    data,
    mesReferencia: cot.mes_referencia,
    itens: itens.map((it, i) => ({ ...it, precoUnitario: precosUnitarios[i] || 0 })),
  };

  return { fileId: copy.id, url: copy.webViewLink, nome: copy.name, snapshot };
}

/** Exporta um Google Sheet como PDF (binário) via Drive. */
export async function exportarSheetComoPdf(fileId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const lov = process.env.LOVABLE_API_KEY;
  const drv = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov || !drv) throw new Error("Conector Google Drive ausente");

  const url = `https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": drv,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`drive.files.export falhou [${res.status}]: ${txt.slice(0, 300)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, filename: `orcamento-${fileId}.pdf` };
}
