/**
 * REO Mensal Financeiro (Lei 13.019/2014, art. 66, II).
 *
 * Server functions para:
 *  - Plano de aplicação (previsto por natureza da despesa)
 *  - Repasses recebidos (item 2.1)
 *  - Movimento bancário mensal — saldo/rendimentos/estornos (item 2.3)
 *  - Enriquecimento de eventos com natureza da despesa
 *  - Consolidação dos dados do REO de um mês
 *  - Geração do PDF final
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

async function orgId(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_org");
  if (error || !data) throw new Error("Organização ativa não encontrada");
  return data as string;
}

const MesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mês inválido (AAAA-MM)");

// ─────────────────────────────────────────────────────────────
// Catálogo de naturezas
// ─────────────────────────────────────────────────────────────
export const listarNaturezas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("naturezas_despesa")
      .select("codigo, descricao, grupo")
      .eq("ativo", true)
      .order("codigo");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ codigo: string; descricao: string; grupo: string }>;
  });

// ─────────────────────────────────────────────────────────────
// Plano de aplicação
// ─────────────────────────────────────────────────────────────
export const listarPlanoAplicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ vigenciaInicio: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    let q = (context.supabase as any)
      .from("plano_aplicacao")
      .select("id, vigencia_inicio, vigencia_fim, natureza_codigo, valor_previsto, convenio")
      .eq("organization_id", id)
      .order("natureza_codigo");
    if (data.vigenciaInicio) q = q.eq("vigencia_inicio", data.vigenciaInicio);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const salvarLinhaPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      vigencia_inicio: z.string(),
      vigencia_fim: z.string(),
      natureza_codigo: z.string(),
      valor_previsto: z.number().min(0),
      convenio: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const row = { ...data, organization_id: id, convenio: data.convenio ?? null };
    if (data.id) {
      const { error } = await (context.supabase as any)
        .from("plano_aplicacao")
        .update(row)
        .eq("id", data.id)
        .eq("organization_id", id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await (context.supabase as any)
      .from("plano_aplicacao")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const removerLinhaPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const { error } = await (context.supabase as any)
      .from("plano_aplicacao")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────
// Repasses recebidos
// ─────────────────────────────────────────────────────────────
export const listarRepasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mes: MesSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const { data: rows, error } = await (context.supabase as any)
      .from("repasses_recebidos")
      .select("*")
      .eq("organization_id", id)
      .eq("mes_referencia", data.mes)
      .order("numero_parcela");
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const salvarRepasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      mes_referencia: MesSchema,
      numero_parcela: z.number().int().min(1),
      valor: z.number().min(0),
      data_recebimento: z.string(),
      convenio: z.string().nullable().optional(),
      observacao: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const row = { ...data, organization_id: id };
    if (data.id) {
      const { error } = await (context.supabase as any)
        .from("repasses_recebidos")
        .update(row)
        .eq("id", data.id)
        .eq("organization_id", id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await (context.supabase as any)
      .from("repasses_recebidos")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const removerRepasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const { error } = await (context.supabase as any)
      .from("repasses_recebidos")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────
// Movimento bancário mensal
// ─────────────────────────────────────────────────────────────
export const salvarMovimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      mes_referencia: MesSchema,
      saldo_anterior: z.number(),
      rendimentos: z.number(),
      estornos_extra: z.number(),
      observacao: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const row = { ...data, organization_id: id };
    const { error } = await (context.supabase as any)
      .from("movimento_bancario_mensal")
      .upsert(row, { onConflict: "organization_id,mes_referencia" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────
// Vinculação natureza -> evento
// ─────────────────────────────────────────────────────────────
export const setNaturezaEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      evento_id: z.string().uuid(),
      natureza_codigo: z.string().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    const { error } = await (context.supabase as any)
      .from("eventos_financeiros")
      .update({ natureza_despesa_codigo: data.natureza_codigo })
      .eq("id", data.evento_id)
      .eq("organization_id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────
// Consolidação do REO de um mês
// ─────────────────────────────────────────────────────────────
async function computeReo(supabase: any, id: string, anoMes: string) {
  const [ano] = anoMes.split("-");

  const { data: repasses } = await supabase
    .from("repasses_recebidos")
    .select("*")
    .eq("organization_id", id)
    .eq("mes_referencia", anoMes)
    .order("numero_parcela");

  const { data: eventos } = await supabase
    .from("eventos_financeiros")
    .select("id, id_interno, nm_favorecido, descricao, valor_efetivo, natureza_despesa_codigo, data_pagamento, valor_estornado")
    .eq("organization_id", id)
    .eq("mes_referencia", anoMes)
    .is("excluido_em", null)
    .not("valor_efetivo", "is", null)
    .order("id_interno");

  const { data: movRow } = await supabase
    .from("movimento_bancario_mensal")
    .select("*")
    .eq("organization_id", id)
    .eq("mes_referencia", anoMes)
    .maybeSingle();

  const dataAlvo = `${anoMes}-01`;
  const { data: plano } = await supabase
    .from("plano_aplicacao")
    .select("natureza_codigo, valor_previsto, vigencia_inicio, vigencia_fim, convenio")
    .eq("organization_id", id)
    .lte("vigencia_inicio", dataAlvo)
    .gte("vigencia_fim", dataAlvo);

  const { data: gastoRows } = await supabase
    .from("eventos_financeiros")
    .select("natureza_despesa_codigo, valor_efetivo, valor_estornado, mes_referencia")
    .eq("organization_id", id)
    .gte("mes_referencia", `${ano}-01`)
    .lte("mes_referencia", anoMes)
    .is("excluido_em", null)
    .not("valor_efetivo", "is", null);

  const gastoPorNat = new Map<string, { gasto: number; estornado: number }>();
  for (const r of (gastoRows ?? []) as any[]) {
    const k = r.natureza_despesa_codigo ?? "__sem__";
    const cur = gastoPorNat.get(k) ?? { gasto: 0, estornado: 0 };
    cur.gasto += Number(r.valor_efetivo ?? 0);
    cur.estornado += Number(r.valor_estornado ?? 0);
    gastoPorNat.set(k, cur);
  }

  const { data: naturezas } = await supabase
    .from("naturezas_despesa")
    .select("codigo, descricao, grupo")
    .eq("ativo", true)
    .order("codigo");
  const descByCod = new Map<string, string>();
  for (const n of (naturezas ?? []) as any[]) descByCod.set(n.codigo, n.descricao);

  const linhas24Base = ((plano ?? []) as any[]).map((p) => {
    const g = gastoPorNat.get(p.natureza_codigo) ?? { gasto: 0, estornado: 0 };
    const previsto = Number(p.valor_previsto ?? 0);
    return {
      codigo: p.natureza_codigo,
      descricao: descByCod.get(p.natureza_codigo) ?? "",
      previsto,
      gasto: g.gasto,
      estornado: g.estornado,
      disponivel: previsto - g.gasto + g.estornado,
    };
  });

  const codsPlano = new Set(linhas24Base.map((l) => l.codigo));
  const semPrevisto: typeof linhas24Base = [];
  for (const [cod, g] of gastoPorNat) {
    if (cod === "__sem__" || codsPlano.has(cod)) continue;
    semPrevisto.push({
      codigo: cod,
      descricao: descByCod.get(cod) ?? "(fora do plano)",
      previsto: 0,
      gasto: g.gasto,
      estornado: g.estornado,
      disponivel: -g.gasto + g.estornado,
    });
  }

  const semNatureza = gastoPorNat.get("__sem__") ?? { gasto: 0, estornado: 0 };

  const valorTransferido = ((repasses ?? []) as any[]).reduce((a, r) => a + Number(r.valor ?? 0), 0);
  const valorExecutado = ((eventos ?? []) as any[]).reduce((a, e) => a + Number(e.valor_efetivo ?? 0), 0);
  const estornosEventosMes = ((eventos ?? []) as any[]).reduce((a, e) => a + Number(e.valor_estornado ?? 0), 0);
  const saldoAnterior = Number(movRow?.saldo_anterior ?? 0);
  const rendimentos = Number(movRow?.rendimentos ?? 0);
  const estornosExtra = Number(movRow?.estornos_extra ?? 0);
  const totalEstornos = estornosEventosMes + estornosExtra;
  const saldoProximo = saldoAnterior + valorTransferido + rendimentos - valorExecutado + totalEstornos;

  const { data: org } = await supabase
    .from("organizations")
    .select("nome, cnpj")
    .eq("id", id)
    .maybeSingle();

  return {
    mes: anoMes,
    org: { nome: org?.nome ?? "", cnpj: org?.cnpj ?? "" },
    repasses: repasses ?? [],
    eventos: eventos ?? [],
    movimento: {
      saldo_anterior: saldoAnterior,
      valor_transferido: valorTransferido,
      rendimentos,
      estornos: totalEstornos,
      valor_executado: valorExecutado,
      saldo_proximo: saldoProximo,
      observacao: movRow?.observacao ?? null,
      estornos_extra: estornosExtra,
    },
    linhas24: [...linhas24Base, ...semPrevisto].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    semNaturezaGasto: semNatureza.gasto,
  };
}

export const carregarReo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mes: MesSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const id = await orgId(context.supabase);
    return computeReo(context.supabase, id, data.mes);
  });


    // 2.1 — repasses do mês
    const { data: repasses } = await (supabase as any)
      .from("repasses_recebidos")
      .select("*")
      .eq("organization_id", id)
      .eq("mes_referencia", anoMes)
      .order("numero_parcela");

    // 2.2 — despesas efetuadas no mês (não excluídas, com pagamento no mês)
    const { data: eventos } = await (supabase as any)
      .from("eventos_financeiros")
      .select("id, id_interno, nm_favorecido, descricao, valor_efetivo, natureza_despesa_codigo, data_pagamento, valor_estornado")
      .eq("organization_id", id)
      .eq("mes_referencia", anoMes)
      .is("excluido_em", null)
      .not("valor_efetivo", "is", null)
      .order("id_interno");

    // 2.3 — movimento do mês
    const { data: movRow } = await (supabase as any)
      .from("movimento_bancario_mensal")
      .select("*")
      .eq("organization_id", id)
      .eq("mes_referencia", anoMes)
      .maybeSingle();

    // 2.4 — plano vigente + gasto acumulado no ano por natureza
    const dataAlvo = `${anoMes}-01`;
    const { data: plano } = await (supabase as any)
      .from("plano_aplicacao")
      .select("natureza_codigo, valor_previsto, vigencia_inicio, vigencia_fim, convenio")
      .eq("organization_id", id)
      .lte("vigencia_inicio", dataAlvo)
      .gte("vigencia_fim", dataAlvo);

    // Gasto acumulado (todos os meses do ano até este, inclusive)
    const { data: gastoRows } = await (supabase as any)
      .from("eventos_financeiros")
      .select("natureza_despesa_codigo, valor_efetivo, valor_estornado, mes_referencia")
      .eq("organization_id", id)
      .gte("mes_referencia", `${ano}-01`)
      .lte("mes_referencia", anoMes)
      .is("excluido_em", null)
      .not("valor_efetivo", "is", null);

    const gastoPorNat = new Map<string, { gasto: number; estornado: number }>();
    for (const r of (gastoRows ?? []) as any[]) {
      const k = r.natureza_despesa_codigo ?? "__sem__";
      const cur = gastoPorNat.get(k) ?? { gasto: 0, estornado: 0 };
      cur.gasto += Number(r.valor_efetivo ?? 0);
      cur.estornado += Number(r.valor_estornado ?? 0);
      gastoPorNat.set(k, cur);
    }

    const { data: naturezas } = await (supabase as any)
      .from("naturezas_despesa")
      .select("codigo, descricao, grupo")
      .eq("ativo", true)
      .order("codigo");
    const descByCod = new Map<string, string>();
    for (const n of (naturezas ?? []) as any[]) descByCod.set(n.codigo, n.descricao);

    const linhas24 = ((plano ?? []) as any[]).map((p) => {
      const g = gastoPorNat.get(p.natureza_codigo) ?? { gasto: 0, estornado: 0 };
      const previsto = Number(p.valor_previsto ?? 0);
      const gasto = g.gasto;
      const estornado = g.estornado;
      const disponivel = previsto - gasto + estornado;
      return {
        codigo: p.natureza_codigo,
        descricao: descByCod.get(p.natureza_codigo) ?? "",
        previsto,
        gasto,
        estornado,
        disponivel,
      };
    });

    // Linhas com gasto mas sem previsto (alerta)
    const codsPlano = new Set(linhas24.map((l) => l.codigo));
    const semPrevisto: typeof linhas24 = [];
    for (const [cod, g] of gastoPorNat) {
      if (cod === "__sem__" || codsPlano.has(cod)) continue;
      semPrevisto.push({
        codigo: cod,
        descricao: descByCod.get(cod) ?? "(fora do plano)",
        previsto: 0,
        gasto: g.gasto,
        estornado: g.estornado,
        disponivel: -g.gasto + g.estornado,
      });
    }

    const semNatureza = gastoPorNat.get("__sem__") ?? { gasto: 0, estornado: 0 };

    // 2.3 — resumo
    const valorTransferido = ((repasses ?? []) as any[]).reduce((a, r) => a + Number(r.valor ?? 0), 0);
    const valorExecutado = ((eventos ?? []) as any[]).reduce((a, e) => a + Number(e.valor_efetivo ?? 0), 0);
    const estornosEventosMes = ((eventos ?? []) as any[]).reduce((a, e) => a + Number(e.valor_estornado ?? 0), 0);
    const saldoAnterior = Number(movRow?.saldo_anterior ?? 0);
    const rendimentos = Number(movRow?.rendimentos ?? 0);
    const estornosExtra = Number(movRow?.estornos_extra ?? 0);
    const totalEstornos = estornosEventosMes + estornosExtra;
    const saldoProximo = saldoAnterior + valorTransferido + rendimentos - valorExecutado + totalEstornos;

    // Dados da OSC (cabeçalho)
    const { data: org } = await (supabase as any)
      .from("organizations")
      .select("nome, cnpj")
      .eq("id", id)
      .maybeSingle();

    return {
      mes: anoMes,
      org: { nome: org?.nome ?? "", cnpj: org?.cnpj ?? "" },
      repasses: repasses ?? [],
      eventos: eventos ?? [],
      movimento: {
        saldo_anterior: saldoAnterior,
        valor_transferido: valorTransferido,
        rendimentos,
        estornos: totalEstornos,
        valor_executado: valorExecutado,
        saldo_proximo: saldoProximo,
        observacao: movRow?.observacao ?? null,
        estornos_extra: estornosExtra,
      },
      linhas24: [...linhas24, ...semPrevisto].sort((a, b) => a.codigo.localeCompare(b.codigo)),
      semNaturezaGasto: semNatureza.gasto,
    };
  });

// ─────────────────────────────────────────────────────────────
// Geração do PDF
// ─────────────────────────────────────────────────────────────
function moeda(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawText(page: PDFPage, txt: string, x: number, y: number, font: PDFFont, size: number, opts?: { color?: any; maxWidth?: number }) {
  const color = opts?.color ?? rgb(0, 0, 0);
  const clean = (txt ?? "").replace(/[^\x00-\xFF]/g, (c) => {
    // pdf-lib StandardFonts (WinAnsi) — troca acentos/símbolos fora do repertório
    const map: Record<string, string> = { "—": "-", "–": "-", "•": "-", "…": "..." };
    return map[c] ?? c;
  });
  page.drawText(clean, { x, y, size, font, color });
}

function newPage(pdf: PDFDocument): PDFPage {
  return pdf.addPage([595.28, 841.89]); // A4
}

export const gerarReoPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mes: MesSchema }).parse(d))
  .handler(async ({ data, context }) => {
    // Reaproveita carregarReo internamente
    const { supabase } = context;
    const id = await orgId(supabase);
    // Chama a mesma lógica de carregarReo diretamente (evita ida ao HTTP)
    const reo = await (async () => {
      const fn = carregarReo as any;
      return fn({ data: { mes: data.mes }, context } as any);
    })().catch(async () => {
      // fallback: recarrega manualmente
      throw new Error("Falha ao carregar dados do REO");
    });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = newPage(pdf);
    const M = 45;
    const W = 595.28;
    let y = 800;

    const header = () => {
      drawText(page, reo.org.nome || "Organização", M, y, bold, 12);
      y -= 14;
      if (reo.org.cnpj) {
        drawText(page, `CNPJ: ${reo.org.cnpj}`, M, y, font, 9);
        y -= 12;
      }
      drawText(page, `Relatório de Execução do Objeto — Execução Financeira`, M, y, bold, 11);
      y -= 12;
      drawText(page, `Mês de referência: ${reo.mes}`, M, y, font, 9);
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      y -= 16;
    };
    const ensure = (need: number) => {
      if (y - need < 60) { page = newPage(pdf); y = 800; header(); }
    };
    header();

    // 2.1 Valores transferidos
    drawText(page, "2.1 Valores transferidos", M, y, bold, 11); y -= 16;
    if (!reo.repasses.length) {
      drawText(page, "Sem repasses recebidos neste mês.", M, y, font, 9); y -= 14;
    } else {
      drawText(page, "Parcela", M, y, bold, 9);
      drawText(page, "Valor", M + 80, y, bold, 9);
      drawText(page, "Data recebimento", M + 200, y, bold, 9);
      drawText(page, "Convênio", M + 340, y, bold, 9);
      y -= 12;
      for (const r of reo.repasses as any[]) {
        ensure(12);
        drawText(page, String(r.numero_parcela), M, y, font, 9);
        drawText(page, moeda(Number(r.valor)), M + 80, y, font, 9);
        drawText(page, r.data_recebimento, M + 200, y, font, 9);
        drawText(page, r.convenio ?? "-", M + 340, y, font, 9);
        y -= 12;
      }
    }
    y -= 8;

    // 2.2 Despesas
    ensure(40);
    drawText(page, "2.2 Despesas efetuadas no mês", M, y, bold, 11); y -= 16;
    drawText(page, "Código", M, y, bold, 9);
    drawText(page, "Favorecido", M + 60, y, bold, 9);
    drawText(page, "Natureza", M + 320, y, bold, 9);
    drawText(page, "Valor", W - M - 55, y, bold, 9);
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) }); y -= 8;
    let totalDespesas = 0;
    for (const e of reo.eventos as any[]) {
      ensure(12);
      drawText(page, e.id_interno ?? "-", M, y, font, 9);
      const fav = (e.nm_favorecido || e.descricao || "").slice(0, 44);
      drawText(page, fav, M + 60, y, font, 9);
      drawText(page, e.natureza_despesa_codigo ?? "—", M + 320, y, font, 9);
      const v = Number(e.valor_efetivo ?? 0);
      totalDespesas += v;
      drawText(page, moeda(v), W - M - 60, y, font, 9);
      y -= 12;
    }
    ensure(20);
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
    drawText(page, "TOTAL GERAL", M, y - 6, bold, 10);
    drawText(page, moeda(totalDespesas), W - M - 60, y - 6, bold, 10);
    y -= 26;

    // 2.3 Resumo financeiro
    ensure(120);
    drawText(page, "2.3 Resumo financeiro", M, y, bold, 11); y -= 16;
    const linhasMov: Array<[string, string]> = [
      ["Saldo Anterior", moeda(reo.movimento.saldo_anterior)],
      ["Valores Transferidos", moeda(reo.movimento.valor_transferido)],
      ["Rendimentos", moeda(reo.movimento.rendimentos)],
      ["Valores Estornados", moeda(reo.movimento.estornos)],
      ["Valor Executado", moeda(reo.movimento.valor_executado)],
      ["Saldo para o mês seguinte", moeda(reo.movimento.saldo_proximo)],
    ];
    for (const [k, v] of linhasMov) {
      ensure(14);
      drawText(page, k, M, y, font, 10);
      drawText(page, v, W - M - 120, y, font, 10);
      y -= 14;
    }
    if (reo.movimento.observacao) {
      ensure(20);
      y -= 4;
      drawText(page, `Obs.: ${reo.movimento.observacao}`, M, y, font, 9); y -= 14;
    }
    y -= 8;

    // 2.4 Saldo por natureza
    ensure(60);
    drawText(page, "2.4 Saldo atualizado por categoria (natureza da despesa)", M, y, bold, 11); y -= 16;
    drawText(page, "Código", M, y, bold, 8);
    drawText(page, "Descrição", M + 70, y, bold, 8);
    drawText(page, "Previsto", M + 265, y, bold, 8);
    drawText(page, "Gasto", M + 340, y, bold, 8);
    drawText(page, "Estornado", M + 400, y, bold, 8);
    drawText(page, "Disponível", W - M - 60, y, bold, 8);
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) }); y -= 8;
    let tPrev = 0, tGasto = 0, tEst = 0, tDisp = 0;
    for (const l of reo.linhas24 as any[]) {
      ensure(11);
      drawText(page, l.codigo, M, y, font, 8);
      drawText(page, (l.descricao || "").slice(0, 34), M + 70, y, font, 8);
      drawText(page, moeda(l.previsto), M + 245, y, font, 8);
      drawText(page, moeda(l.gasto), M + 320, y, font, 8);
      drawText(page, moeda(l.estornado), M + 390, y, font, 8);
      const color = l.disponivel < 0 ? rgb(0.7, 0.1, 0.1) : undefined;
      drawText(page, moeda(l.disponivel), W - M - 65, y, font, 8, color ? { color } : undefined);
      tPrev += l.previsto; tGasto += l.gasto; tEst += l.estornado; tDisp += l.disponivel;
      y -= 11;
    }
    ensure(20);
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) });
    drawText(page, "TOTAL", M, y - 6, bold, 9);
    drawText(page, moeda(tPrev), M + 245, y - 6, bold, 9);
    drawText(page, moeda(tGasto), M + 320, y - 6, bold, 9);
    drawText(page, moeda(tEst), M + 390, y - 6, bold, 9);
    drawText(page, moeda(tDisp), W - M - 65, y - 6, bold, 9);
    y -= 30;

    if (reo.semNaturezaGasto > 0) {
      ensure(20);
      drawText(page,
        `Atenção: ${moeda(reo.semNaturezaGasto)} em despesas do ano ainda sem natureza classificada.`,
        M, y, font, 9, { color: rgb(0.7, 0.1, 0.1) });
      y -= 14;
    }

    const bytes = await pdf.save();
    // base64 (edge-safe)
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(bin);
    void id; // silence unused
    return {
      base64,
      filename: `REO_${reo.mes}_${(reo.org.nome || "org").replace(/[^\w-]+/g, "_")}.pdf`,
      totalDespesas,
      totalPaginas: pdf.getPageCount(),
    };
  });
