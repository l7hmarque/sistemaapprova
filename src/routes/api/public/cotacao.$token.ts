/**
 * Endpoint público do portal do fornecedor.
 * GET  /api/public/cotacao/:token         → retorna dados do convite + itens
 * POST /api/public/cotacao/:token         → recebe respostas, gera Sheet+PDF
 *
 * Acessível sem autenticação. Validamos o token antes de qualquer leitura/escrita.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { criarSheetOrcamentoCotacao, exportarSheetComoPdf } from "@/lib/cotacoes.server";

const SubmissaoSchema = z.object({
  // dados do fornecedor (editáveis pelo próprio)
  razao_social: z.string().min(1).max(255),
  cnpj: z.string().min(1).max(40),
  email: z.string().email().max(255).nullish().or(z.literal("")),
  telefone: z.string().max(40).nullish(),
  representante_legal: z.string().max(255).nullish(),
  cpf_representante: z.string().max(40).nullish(),
  endereco: z.string().max(500).nullish(),
  observacao: z.string().max(2000).nullish(),
  validade_dias: z.number().min(1).max(180).default(30),
  // respostas: array por item
  respostas: z
    .array(
      z.object({
        precoUnitario: z.number().min(0).default(0),
        indisponivel: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(200),
});

async function carregarModeloAtivo(): Promise<{ template_id: string; aba: string; params: any } | null> {
  const { data } = await supabaseAdmin
    .from("modelos_planilha")
    .select("template_id, aba, params")
    .eq("tipo", "orcamento")
    .eq("ativo", true)
    .maybeSingle();
  return data as any;
}

async function buscarConvite(token: string) {
  const { data, error } = await supabaseAdmin
    .from("convites_cotacao")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const Route = createFileRoute("/api/public/cotacao/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convite = await buscarConvite(params.token);
        if (!convite) return new Response("Convite não encontrado", { status: 404 });
        if (new Date(convite.expira_em) < new Date()) {
          return Response.json({ status: "expirado", convite: null, cotacao: null });
        }
        const { data: cot } = await supabaseAdmin
          .from("cotacoes")
          .select("id, objeto, termo, mes_referencia, itens")
          .eq("id", convite.cotacao_id)
          .single();
        return Response.json({
          status: convite.status,
          convite: {
            id: convite.id,
            razao_social: convite.razao_social,
            cnpj: convite.cnpj,
            email: convite.email,
            telefone: convite.telefone,
            representante_legal: convite.representante_legal,
            cpf_representante: convite.cpf_representante,
            endereco: convite.endereco,
            observacao_fornecedor: convite.observacao_fornecedor,
            respondido_em: convite.respondido_em,
            orcamento_id: convite.orcamento_id,
          },
          cotacao: cot,
        });
      },

      POST: async ({ params, request }) => {
        const convite = await buscarConvite(params.token);
        if (!convite) return new Response("Convite não encontrado", { status: 404 });
        if (new Date(convite.expira_em) < new Date()) {
          return new Response("Convite expirado", { status: 410 });
        }
        if (convite.status === "preenchido") {
          return new Response("Já respondido", { status: 409 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }
        let input: z.infer<typeof SubmissaoSchema>;
        try {
          input = SubmissaoSchema.parse(body);
        } catch (e) {
          return new Response("Dados inválidos: " + (e as Error).message, { status: 400 });
        }

        const { data: cot, error: errCot } = await supabaseAdmin
          .from("cotacoes")
          .select("*")
          .eq("id", convite.cotacao_id)
          .single();
        if (errCot || !cot) return new Response("Cotação não encontrada", { status: 404 });

        const itens = (cot.itens as Array<{ descricao: string; qtd: number; unidade: string }>) ?? [];
        if (itens.length !== input.respostas.length) {
          return new Response("Quantidade de itens não bate", { status: 400 });
        }

        // Precos: indisponiveis viram 0
        const precos = input.respostas.map((r) => (r.indisponivel ? 0 : r.precoUnitario));

        const modelo = await carregarModeloAtivo();
        let sheet: { fileId: string; url: string; nome: string; snapshot: any };
        try {
          sheet = await criarSheetOrcamentoCotacao({
            orgId: (cot as any).organization_id,
            cotacao: {
              id: cot.id,
              objeto: cot.objeto,
              termo: cot.termo,
              mes_referencia: cot.mes_referencia,
              itens,
            },
            fornecedor: {
              razao: input.razao_social,
              cnpj: input.cnpj,
              representante: input.representante_legal ?? "",
              cpf: input.cpf_representante ?? "",
            },
            precosUnitarios: precos,
            data: new Date().toLocaleDateString("pt-BR"),
            validadeDias: input.validade_dias,
            modelo,
          });
        } catch (e) {
          console.error("criarSheetOrcamentoCotacao falhou:", e);
          return new Response("Falha ao processar solicitação. Tente novamente ou contate o suporte.", { status: 502 });
        }

        // Anexa respostas (com flag indisponivel)
        const snapshotComFlags = {
          ...sheet.snapshot,
          itens: sheet.snapshot.itens.map((it: any, i: number) => ({
            ...it,
            indisponivel: input.respostas[i].indisponivel,
          })),
        };

        // Persiste orçamento
        const { data: orcRow } = await supabaseAdmin
          .from("orcamentos_salvos")
          .insert({
            organization_id: cot.organization_id,
            tipo: "cotacao",
            objeto: cot.objeto,
            termo: cot.termo,
            mes_referencia: cot.mes_referencia,
            cotacao_id: cot.id,
            status: "preenchido",
            fornecedor_id: convite.fornecedor_id,
            dados: snapshotComFlags,
            drive_file_id: sheet.fileId,
            drive_file_url: sheet.url,
          })
          .select()
          .single();

        // Atualiza convite + dados do fornecedor
        await supabaseAdmin
          .from("convites_cotacao")
          .update({
            razao_social: input.razao_social,
            cnpj: input.cnpj,
            email: input.email || null,
            telefone: input.telefone || null,
            representante_legal: input.representante_legal || null,
            cpf_representante: input.cpf_representante || null,
            endereco: input.endereco || null,
            observacao_fornecedor: input.observacao || null,
            respostas: input.respostas,
            status: "preenchido",
            respondido_em: new Date().toISOString(),
            orcamento_id: orcRow?.id ?? null,
          })
          .eq("id", convite.id);

        // Se vinculado a um fornecedor, atualiza dados de contato
        if (convite.fornecedor_id) {
          await supabaseAdmin
            .from("fornecedores")
            .update({
              email: input.email || null,
              telefone: input.telefone || null,
              representante_legal: input.representante_legal || null,
              cpf_representante: input.cpf_representante || null,
              endereco: input.endereco || null,
            })
            .eq("id", convite.fornecedor_id);
        }

        return Response.json({
          ok: true,
          fileId: sheet.fileId,
          sheet_url: sheet.url,
          pdf_url: `/api/public/cotacao/${params.token}/pdf`,
        });
      },
    },
  },
});
