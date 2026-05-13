import { supabase } from "@/integrations/supabase/client";
import type { ExtracaoResultado } from "@/lib/extract/schema";

export type ExtracaoSalvaResumo = {
  id: string;
  criada_em: string;
  mes_referencia: string | null;
  nome_arquivo: string | null;
};

export async function salvarExtracaoOnline(args: {
  dados: ExtracaoResultado;
  nomeArquivo?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("extracoes_salvas")
    .insert({
      mes_referencia: args.dados.mesReferencia ?? null,
      nome_arquivo: args.nomeArquivo ?? null,
      dados: args.dados,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listarExtracoesOnline(): Promise<ExtracaoSalvaResumo[]> {
  const { data, error } = await supabase
    .from("extracoes_salvas")
    .select("id, criada_em, mes_referencia, nome_arquivo")
    .order("criada_em", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExtracaoSalvaResumo[];
}

export async function carregarExtracaoOnline(id: string): Promise<ExtracaoResultado> {
  const { data, error } = await supabase
    .from("extracoes_salvas")
    .select("dados")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data.dados as ExtracaoResultado;
}

export async function apagarExtracaoOnline(id: string): Promise<void> {
  const { error } = await supabase.from("extracoes_salvas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
