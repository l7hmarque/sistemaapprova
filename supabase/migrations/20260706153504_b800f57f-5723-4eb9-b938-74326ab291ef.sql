
CREATE TABLE public.captura_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  arquivo_hash text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes integer,
  mes_referencia text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','processando','concluido','erro','cancelado')),
  mensagem text,
  tentativas integer NOT NULL DEFAULT 0,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  evento_id uuid REFERENCES public.eventos_financeiros(id) ON DELETE SET NULL,
  documento_id uuid REFERENCES public.documentos_anexos(id) ON DELETE SET NULL,
  dados jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_captura_jobs_org_status ON public.captura_jobs (organization_id, status);
CREATE INDEX idx_captura_jobs_org_criado ON public.captura_jobs (organization_id, criado_em DESC);
CREATE INDEX idx_captura_jobs_status_criado ON public.captura_jobs (status, criado_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.captura_jobs TO authenticated;
GRANT ALL ON public.captura_jobs TO service_role;

ALTER TABLE public.captura_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros veem jobs da sua organizacao"
  ON public.captura_jobs FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE POLICY "membros criam jobs na sua organizacao"
  ON public.captura_jobs FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE POLICY "membros atualizam jobs da sua organizacao"
  ON public.captura_jobs FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE POLICY "membros removem jobs da sua organizacao"
  ON public.captura_jobs FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE TRIGGER trg_captura_jobs_touch
  BEFORE UPDATE ON public.captura_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

ALTER PUBLICATION supabase_realtime ADD TABLE public.captura_jobs;
