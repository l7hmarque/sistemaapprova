CREATE TABLE public.modelos_planilha (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('orcamento','mapa','controle_bancario')),
  nome TEXT NOT NULL,
  template_id TEXT NOT NULL,
  aba TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.modelos_planilha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos select all" ON public.modelos_planilha FOR SELECT USING (true);
CREATE POLICY "modelos insert anon" ON public.modelos_planilha FOR INSERT WITH CHECK (true);
CREATE POLICY "modelos update anon" ON public.modelos_planilha FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "modelos delete anon" ON public.modelos_planilha FOR DELETE USING (true);

CREATE UNIQUE INDEX modelos_planilha_um_ativo_por_tipo
  ON public.modelos_planilha (tipo) WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.touch_modelos_planilha()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER modelos_planilha_touch
BEFORE UPDATE ON public.modelos_planilha
FOR EACH ROW EXECUTE FUNCTION public.touch_modelos_planilha();