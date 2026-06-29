/**
 * Server functions para Prestação de Contas.
 * Copia um template do Google Docs e injeta a lista de documentos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { driveCopyFile } from "./orcamentos.server";
import { ensureMesFolder } from "./drive-org.server";

const GDOCS = "https://connector-gateway.lovable.dev/google_docs/v1";

function gdocsHeaders(): HeadersInit {
  const lov = process.env.LOVABLE_API_KEY;
  const docs = process.env.GOOGLE_DOCS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente");
  if (!docs) throw new Error("GOOGLE_DOCS_API_KEY ausente — conecte o Google Docs em Connectors.");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": docs,
  };
}


async function jsonOrThrow(res: Response, ctx: string): Promise<any> {
  const txt = await res.text();
  if (!res.ok) throw new Error(`${ctx} falhou [${res.status}]: ${txt.slice(0, 400)}`);
  try { return JSON.parse(txt); } catch { return {}; }
}

async function docsBatchUpdate(documentId: string, requests: unknown[]): Promise<void> {
  if (!requests.length) return;
  const res = await fetch(`${GDOCS}/documents/${documentId}:batchUpdate`, {
    method: "POST",
    headers: { ...gdocsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  await jsonOrThrow(res, "docs.batchUpdate");
}

async function getDocLength(documentId: string): Promise<number> {
  const res = await fetch(`${GDOCS}/documents/${documentId}?fields=body.content`, {
    headers: gdocsHeaders(),
  });
  const data = await jsonOrThrow(res, "docs.get");
  const content = data.body?.content ?? [];
  if (!content.length) return 1;
  const last = content[content.length - 1];
  return Math.max(1, (last.endIndex ?? 1) - 1);
}

const Input = z.object({
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
  titulo: z.string().max(200).optional(),
});

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const gerarPrestacaoContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    // 1) buscar template ID das configurações
    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "prestacao_template")
      .maybeSingle();
    const templateId = (cfg?.valor as any)?.template_id as string | undefined;
    if (!templateId) {
      throw new Error("Template de Prestação de Contas não configurado em Admin → Configurações.");
    }

    // 2) buscar documentos do mês ordenados
    const { data: docs, error } = await supabase
      .from("prestacao_documentos")
      .select("*")
      .eq("mes_referencia", data.mesReferencia)
      .order("ordem", { ascending: true });
    if (error) throw new Error("Erro ao buscar documentos: " + error.message);
    if (!docs || docs.length === 0) throw new Error(`Nenhum documento cadastrado para ${data.mesReferencia}.`);

    // 3) copiar template
    const parents = await ensureFolderPath(["Prestacao de Contas", data.mesReferencia]).catch(() => undefined);
    const nome = `Prestacao de Contas — ${data.mesReferencia}${data.titulo ? ` — ${data.titulo}` : ""}`;
    const copy = await driveCopyFile({
      templateId,
      name: nome,
      parents: parents ? [parents] : undefined,
    });

    // 4) montar texto da lista de documentos e anexar ao fim do template
    const length = await getDocLength(copy.id);
    const linhas: string[] = [
      "",
      `RELAÇÃO DE DOCUMENTOS — ${data.mesReferencia}`,
      "",
    ];
    docs.forEach((d, i) => {
      const partes: string[] = [`${i + 1}. ${d.nome}`];
      if (d.descricao) partes.push(`   ${d.descricao}`);
      const datas: string[] = [];
      if (d.data_emissao) datas.push(`emissão: ${fmtDate(d.data_emissao)}`);
      if (d.data_vencimento) datas.push(`vencimento: ${fmtDate(d.data_vencimento)}`);
      if (datas.length) partes.push(`   (${datas.join(" · ")})`);
      if (d.arquivo_url) partes.push(`   Link: ${d.arquivo_url}`);
      linhas.push(partes.join("\n"));
      linhas.push("");
    });
    const texto = "\n" + linhas.join("\n");

    await docsBatchUpdate(copy.id, [
      { insertText: { location: { index: length }, text: texto } },
    ]);

    return { fileId: copy.id, url: copy.webViewLink, nome: copy.name };
  });
