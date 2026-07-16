
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evento_status_workflow') THEN
    CREATE TYPE public.evento_status_workflow AS ENUM ('rascunho','pendente_revisao','aprovado','homologado');
  END IF;
END $$;

ALTER TABLE public.eventos_financeiros
  ADD COLUMN IF NOT EXISTS status_workflow public.evento_status_workflow,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS devolvido_motivo text;

-- Backfill inicial
UPDATE public.eventos_financeiros
   SET status_workflow = CASE
     WHEN prestacao_snapshot_id IS NOT NULL THEN 'homologado'::public.evento_status_workflow
     WHEN status_documental = 'completo' THEN 'aprovado'::public.evento_status_workflow
     ELSE 'pendente_revisao'::public.evento_status_workflow
   END
 WHERE status_workflow IS NULL;

ALTER TABLE public.eventos_financeiros
  ALTER COLUMN status_workflow SET DEFAULT 'pendente_revisao'::public.evento_status_workflow,
  ALTER COLUMN status_workflow SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_org_mes_workflow
  ON public.eventos_financeiros (organization_id, mes_referencia, status_workflow)
  WHERE excluido_em IS NULL;
