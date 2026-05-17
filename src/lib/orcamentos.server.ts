/**
 * Helpers de servidor para o módulo de orçamentos.
 * Faz chamadas ao gateway de Google Drive + Google Sheets.
 *
 * IMPORTANTE: este arquivo nunca deve ser importado no cliente.
 */

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const SHEETS = "https://connector-gateway.lovable.dev/google_sheets/v4";

function authHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const drv = process.env.GOOGLE_DRIVE_API_KEY;
  const sht = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!drv) throw new Error("GOOGLE_DRIVE_API_KEY ausente — conecte o Google Drive");
  if (!sht) throw new Error("GOOGLE_SHEETS_API_KEY ausente — conecte o Google Sheets");
  return { Authorization: `Bearer ${lov}` };
}

function driveHeaders(): HeadersInit {
  return { ...authHeaders(), "X-Connection-Api-Key": process.env.GOOGLE_DRIVE_API_KEY! };
}
function sheetsHeaders(): HeadersInit {
  return { ...authHeaders(), "X-Connection-Api-Key": process.env.GOOGLE_SHEETS_API_KEY! };
}

async function jsonOrThrow(res: Response, ctx: string): Promise<any> {
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`${ctx} falhou [${res.status}]: ${txt.slice(0, 400)}`);
  }
  try { return JSON.parse(txt); } catch { return {}; }
}

/* ============================ DRIVE ============================ */

export async function driveCopyFile(args: {
  templateId: string;
  name: string;
  parents?: string[];
}): Promise<{ id: string; webViewLink: string; name: string }> {
  const res = await fetch(
    `${DRIVE}/files/${args.templateId}/copy?fields=id,name,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { ...driveHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: args.name, parents: args.parents }),
    },
  );
  const data = await jsonOrThrow(res, "drive.files.copy");
  // Se webViewLink não veio, busca em separado.
  if (!data.webViewLink) {
    const res2 = await fetch(`${DRIVE}/files/${data.id}?fields=id,name,webViewLink&supportsAllDrives=true`, {
      headers: driveHeaders(),
    });
    const meta = await jsonOrThrow(res2, "drive.files.get");
    return { id: data.id, name: data.name, webViewLink: meta.webViewLink };
  }
  return { id: data.id, name: data.name, webViewLink: data.webViewLink };
}

/** Garante a pasta "Orcamentos SIT/{AAAA-MM}" no Drive do dono da conexão. */
export async function ensureFolderPath(parts: string[]): Promise<string | undefined> {
  let parent: string | undefined = undefined;
  for (const name of parts) {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name.replace(/'/g, "\\'")}'` +
        (parent ? ` and '${parent}' in parents` : ""),
    );
    const res = await fetch(`${DRIVE}/files?q=${q}&fields=files(id,name)&pageSize=10`, {
      headers: driveHeaders(),
    });
    const data = await jsonOrThrow(res, "drive.files.list");
    const found = (data.files ?? [])[0];
    if (found) {
      parent = found.id;
      continue;
    }
    const create = await fetch(`${DRIVE}/files?fields=id`, {
      method: "POST",
      headers: { ...driveHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parent ? [parent] : undefined,
      }),
    });
    const created = await jsonOrThrow(create, "drive.files.create(folder)");
    parent = created.id;
  }
  return parent;
}

/* ============================ SHEETS ============================ */

export async function sheetsBatchUpdate(spreadsheetId: string, requests: unknown[]): Promise<void> {
  if (!requests.length) return;
  const res = await fetch(`${SHEETS}/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { ...sheetsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  await jsonOrThrow(res, "sheets.batchUpdate");
}

export async function sheetsValuesBatchUpdate(
  spreadsheetId: string,
  data: Array<{ range: string; values: (string | number | null)[][] }>,
): Promise<void> {
  if (!data.length) return;
  const res = await fetch(`${SHEETS}/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { ...sheetsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  await jsonOrThrow(res, "sheets.values.batchUpdate");
}

/** Retorna o sheetId real da primeira aba do arquivo copiado. */
export async function getFirstSheetId(spreadsheetId: string): Promise<{ sheetId: number; title: string }> {
  const res = await fetch(
    `${SHEETS}/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: sheetsHeaders() },
  );
  const data = await jsonOrThrow(res, "sheets.spreadsheets.get");
  const p = data.sheets?.[0]?.properties;
  if (!p) throw new Error("Planilha sem abas");
  return { sheetId: p.sheetId, title: p.title };
}

export async function renameSheet(spreadsheetId: string, sheetId: number, title: string): Promise<void> {
  await sheetsBatchUpdate(spreadsheetId, [
    {
      updateSheetProperties: {
        properties: { sheetId, title },
        fields: "title",
      },
    },
  ]);
}

/**
 * Expande linhas de itens quando qtdNecessaria > qtdExistente.
 * Insere linhas imediatamente acima da linha de totais (herdando formatação)
 * e copia a última linha de item modelo sobre as novas (para replicar fórmulas).
 *
 * Todos os índices aqui são 0-indexed (formato da API).
 */
export async function expandirLinhasItens(args: {
  spreadsheetId: string;
  sheetId: number;
  linhaPrimeiroItem0: number;
  qtdLinhasExistentes: number;
  linhaTotais0: number;
  qtdNecessaria: number;
  colCount: number;
}): Promise<{ linhaTotaisFinal0: number }> {
  const { spreadsheetId, sheetId, linhaPrimeiroItem0, qtdLinhasExistentes, linhaTotais0, qtdNecessaria, colCount } = args;

  if (qtdNecessaria <= qtdLinhasExistentes) {
    return { linhaTotaisFinal0: linhaTotais0 };
  }
  const extras = qtdNecessaria - qtdLinhasExistentes;
  const linhaUltimoItemOriginal0 = linhaPrimeiroItem0 + qtdLinhasExistentes - 1;

  await sheetsBatchUpdate(spreadsheetId, [
    {
      insertDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: linhaTotais0,
          endIndex: linhaTotais0 + extras,
        },
        inheritFromBefore: true,
      },
    },
    {
      copyPaste: {
        source: {
          sheetId,
          startRowIndex: linhaUltimoItemOriginal0,
          endRowIndex: linhaUltimoItemOriginal0 + 1,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        },
        destination: {
          sheetId,
          startRowIndex: linhaTotais0,
          endRowIndex: linhaTotais0 + extras,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        },
        pasteType: "PASTE_NORMAL",
      },
    },
  ]);

  return { linhaTotaisFinal0: linhaTotais0 + extras };
}

/* ============================ TEMPLATES ============================ */

export const TEMPLATE_ORCAMENTO_ID = "1IDWjnJisXhVrRRHSEqIxrqqevXMnlQPj94i3PSNnyno";
export const TEMPLATE_MAPA_ID = "1V_1THOUUWMhpVlb_4peuCmZcgQUno1GxJD2NIm-jooM";

// Após copy, renomeamos a sheet para um nome estável.
export const ABA_ORC = "Orcamento";
export const ABA_MAPA = "MapaComparativo";

// Linhas no template (1-indexed para A1, 0-indexed para API)
export const ORC_MODEL = {
  linhaPrimeiroItem1: 13,
  qtdLinhasExistentes: 5,
  linhaTotais1: 18,
  colCount: 11, // A..K
};

export const MAPA_MODEL = {
  linhaPrimeiroItem1: 19,
  qtdLinhasExistentes: 3,
  linhaTotais1: 23,
  colCount: 12, // A..L
};
