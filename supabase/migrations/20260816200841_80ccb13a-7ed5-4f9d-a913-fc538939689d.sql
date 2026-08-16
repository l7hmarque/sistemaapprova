CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  numero_termo text,
  orgao_concedente text,
  objeto text,
  valor_total numeric,
  vigencia_inicio date,
  vigencia_fim date,
  status text NOT NULL DEFAULT 'ativo',
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage projects in their orgs" ON public.projetos
FOR ALL
TO authenticated
USING (organization_id IN (SELECT public.user_orgs(auth.uid())))
WITH CHECK (organization_id IN (SELECT public.user_orgs(auth.uid())));

CREATE INDEX idx_projetos_organization ON public.projetos(organization_id);
CREATE INDEX idx_projetos_status ON public.projetos(organization_id, status);

ALTER TABLE public.eventos_financeiros ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
ALTER TABLE public.cotacoes ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
ALTER TABLE public.orcamentos_salvos ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
ALTER TABLE public.repasses_recebidos ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
ALTER TABLE public.plano_aplicacao ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;

CREATE INDEX idx_eventos_projeto ON public.eventos_financeiros(projeto_id);
CREATE INDEX idx_cotacoes_projeto ON public.cotacoes(projeto_id);
CREATE INDEX idx_orcamentos_projeto ON public.orcamentos_salvos(projeto_id);
CREATE INDEX idx_repasses_projeto ON public.repasses_recebidos(projeto_id);
CREATE INDEX idx_plano_projeto ON public.plano_aplicacao(projeto_id);

-- Backfill: cria projetos a partir dos termos/convenios existentes
WITH termos_distintos AS (
  SELECT organization_id, termo AS nome
  FROM public.cotacoes
  WHERE termo IS NOT NULL AND termo <> ''
  UNION
  SELECT organization_id, termo
  FROM public.orcamentos_salvos
  WHERE termo IS NOT NULL AND termo <> ''
  UNION
  SELECT organization_id, convenio
  FROM public.repasses_recebidos
  WHERE convenio IS NOT NULL AND convenio <> ''
  UNION
  SELECT organization_id, convenio
  FROM public.plano_aplicacao
  WHERE convenio IS NOT NULL AND convenio <> ''
)
INSERT INTO public.projetos (organization_id, nome, numero_termo, objeto, status)
SELECT organization_id, nome, nome, nome, 'ativo'
FROM termos_distintos
WHERE organization_id IS NOT NULL;

-- Vincula registros existentes aos projetos criados
UPDATE public.cotacoes c
SET projeto_id = p.id
FROM public.projetos p
WHERE c.organization_id = p.organization_id
  AND c.termo = p.numero_termo
  AND c.termo IS NOT NULL AND c.termo <> '';

UPDATE public.orcamentos_salvos o
SET projeto_id = p.id
FROM public.projetos p
WHERE o.organization_id = p.organization_id
  AND o.termo = p.numero_termo
  AND o.termo IS NOT NULL AND o.termo <> '';

UPDATE public.repasses_recebidos r
SET projeto_id = p.id
FROM public.projetos p
WHERE r.organization_id = p.organization_id
  AND r.convenio = p.numero_termo
  AND r.convenio IS NOT NULL AND r.convenio <> '';

UPDATE public.plano_aplicacao pa
SET projeto_id = p.id
FROM public.projetos p
WHERE pa.organization_id = p.organization_id
  AND pa.convenio = p.numero_termo
  AND pa.convenio IS NOT NULL AND pa.convenio <> '';

CREATE TRIGGER trg_projetos_touch
BEFORE UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

CREATE TRIGGER trg_audit_projetos
AFTER INSERT OR UPDATE OR DELETE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();