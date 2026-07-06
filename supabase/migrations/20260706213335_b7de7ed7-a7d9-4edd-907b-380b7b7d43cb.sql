
ALTER TABLE public.prestacao_documentos
  ADD COLUMN IF NOT EXISTS valido_de date,
  ADD COLUMN IF NOT EXISTS valido_ate date,
  ADD COLUMN IF NOT EXISTS mes_referencia_fim text;

UPDATE public.prestacao_documentos
   SET valido_de = COALESCE(valido_de, data_emissao, to_date(mes_referencia || '-01','YYYY-MM-DD')),
       valido_ate = COALESCE(valido_ate, data_vencimento)
 WHERE valido_de IS NULL OR valido_ate IS NULL;

CREATE INDEX IF NOT EXISTS ix_prestacao_documentos_vigencia
  ON public.prestacao_documentos (organization_id, valido_de, valido_ate);

CREATE TABLE IF NOT EXISTS public.prestacao_documentos_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.prestacao_documentos(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  UNIQUE(documento_id, mes_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestacao_documentos_excecoes TO authenticated;
GRANT ALL ON public.prestacao_documentos_excecoes TO service_role;

ALTER TABLE public.prestacao_documentos_excecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros_org_gerenciam_excecoes"
  ON public.prestacao_documentos_excecoes
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE INDEX IF NOT EXISTS ix_prestacao_documentos_excecoes_doc_mes
  ON public.prestacao_documentos_excecoes (documento_id, mes_referencia);
