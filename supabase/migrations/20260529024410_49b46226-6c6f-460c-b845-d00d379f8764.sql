CREATE TABLE public.favorecidos_padrao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  nome text NOT NULL,
  categoria text NOT NULL,
  match_subtipo smallint,
  match_regex text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_favorecidos_padrao_ativo ON public.favorecidos_padrao(ativo);

GRANT SELECT ON public.favorecidos_padrao TO authenticated;
GRANT ALL ON public.favorecidos_padrao TO service_role;

ALTER TABLE public.favorecidos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorecidos_padrao_select_all"
  ON public.favorecidos_padrao
  FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "favorecidos_padrao_super_admin_write"
  ON public.favorecidos_padrao
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.favorecidos_padrao (cnpj, nome, categoria, match_subtipo) VALUES
  ('00394460000141', 'MINISTERIO DA FAZENDA - MATRIZ', 'DARF', 7),
  ('16727230000197', 'FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL', 'GPS', 9),
  ('00360305000104', 'CAIXA ECONOMICA FEDERAL', 'GFIP', 10);

INSERT INTO public.favorecidos_padrao (cnpj, nome, categoria, match_regex) VALUES
  ('76484013000145', 'COMPANHIA DE SANEAMENTO DO PARANA - SANEPAR', 'Sanepar', '\bSANEPAR\b'),
  ('76483817000120', 'COPEL DISTRIBUICAO S.A.', 'Copel', 'COPEL');