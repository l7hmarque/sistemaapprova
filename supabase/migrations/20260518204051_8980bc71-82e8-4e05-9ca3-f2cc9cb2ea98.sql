CREATE TABLE public.configuracoes (
  chave TEXT NOT NULL PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "configuracoes select all" ON public.configuracoes FOR SELECT USING (true);
CREATE POLICY "configuracoes insert anon" ON public.configuracoes FOR INSERT WITH CHECK (true);
CREATE POLICY "configuracoes update anon" ON public.configuracoes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "configuracoes delete anon" ON public.configuracoes FOR DELETE USING (true);

CREATE TABLE public.prestacao_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem INTEGER NOT NULL DEFAULT 0,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  drive_file_id TEXT,
  data_emissao DATE,
  data_vencimento DATE,
  mes_referencia TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prestacao_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestacao select all" ON public.prestacao_documentos FOR SELECT USING (true);
CREATE POLICY "prestacao insert anon" ON public.prestacao_documentos FOR INSERT WITH CHECK (true);
CREATE POLICY "prestacao update anon" ON public.prestacao_documentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prestacao delete anon" ON public.prestacao_documentos FOR DELETE USING (true);

CREATE INDEX prestacao_documentos_ordem_idx ON public.prestacao_documentos (mes_referencia, ordem);
CREATE INDEX prestacao_documentos_vencimento_idx ON public.prestacao_documentos (data_vencimento) WHERE data_vencimento IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prestacao_documentos_touch
BEFORE UPDATE ON public.prestacao_documentos
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

CREATE TRIGGER configuracoes_touch
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();