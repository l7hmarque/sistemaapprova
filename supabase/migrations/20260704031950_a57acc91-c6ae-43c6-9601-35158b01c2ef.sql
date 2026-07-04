
-- =========================================================
-- MILESTONE 1 — Blindagem multi-tenant, soft-delete, id_interno sequencial
-- =========================================================

-- ---------------------------------------------------------
-- 1.2 SOFT-DELETE DE eventos_financeiros
-- ---------------------------------------------------------
ALTER TABLE public.eventos_financeiros
  ADD COLUMN IF NOT EXISTS excluido_em  timestamptz,
  ADD COLUMN IF NOT EXISTS excluido_por uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_eventos_financeiros_excluido_em
  ON public.eventos_financeiros (organization_id, excluido_em);

-- Trigger BEFORE DELETE: intercepta exclusão física e converte em soft-delete
CREATE OR REPLACE FUNCTION public.fn_eventos_financeiros_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.eventos_financeiros
     SET excluido_em  = COALESCE(excluido_em, now()),
         excluido_por = COALESCE(excluido_por, auth.uid())
   WHERE id = OLD.id
     AND excluido_em IS NULL;
  RETURN NULL; -- cancela DELETE físico
END;
$$;

DROP TRIGGER IF EXISTS trg_eventos_financeiros_soft_delete ON public.eventos_financeiros;
CREATE TRIGGER trg_eventos_financeiros_soft_delete
  BEFORE DELETE ON public.eventos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_eventos_financeiros_soft_delete();

-- Ajusta policies SELECT/UPDATE para esconder registros excluídos
-- (super_admin continua vendo tudo)
DROP POLICY IF EXISTS org_select ON public.eventos_financeiros;
CREATE POLICY org_select ON public.eventos_financeiros
  FOR SELECT
  USING (
    (
      (organization_id IN (SELECT user_orgs(auth.uid())))
      AND excluido_em IS NULL
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS org_update ON public.eventos_financeiros;
CREATE POLICY org_update ON public.eventos_financeiros
  FOR UPDATE
  USING (
    (
      (organization_id IN (SELECT user_orgs(auth.uid())))
      AND excluido_em IS NULL
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ---------------------------------------------------------
-- 1.2 AUDITORIA GENÉRICA em audit_log
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_org := (OLD).organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_org := (NEW).organization_id;
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_org := (NEW).organization_id;
  END IF;

  INSERT INTO public.audit_log (organization_id, user_id, acao, payload)
  VALUES (
    v_org,
    auth.uid(),
    TG_TABLE_NAME || ':' || TG_OP,
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- eventos_financeiros
DROP TRIGGER IF EXISTS trg_audit_eventos_financeiros ON public.eventos_financeiros;
CREATE TRIGGER trg_audit_eventos_financeiros
  AFTER INSERT OR UPDATE OR DELETE ON public.eventos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- fornecedores
DROP TRIGGER IF EXISTS trg_audit_fornecedores ON public.fornecedores;
CREATE TRIGGER trg_audit_fornecedores
  AFTER INSERT OR UPDATE OR DELETE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- configuracoes
DROP TRIGGER IF EXISTS trg_audit_configuracoes ON public.configuracoes;
CREATE TRIGGER trg_audit_configuracoes
  AFTER INSERT OR UPDATE OR DELETE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- ---------------------------------------------------------
-- 1.3 CONTADORES DE PERÍODO + TRIGGER id_interno SEQUENCIAL
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contadores_periodo (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mes_referencia  text NOT NULL,
  ultimo_numero   int  NOT NULL DEFAULT 0,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, mes_referencia)
);

GRANT SELECT ON public.contadores_periodo TO authenticated;
GRANT ALL    ON public.contadores_periodo TO service_role;

ALTER TABLE public.contadores_periodo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contadores_periodo_select ON public.contadores_periodo;
CREATE POLICY contadores_periodo_select ON public.contadores_periodo
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT user_orgs(auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
-- INSERT/UPDATE ficam somente via trigger SECURITY DEFINER; sem policy pública.

-- Trigger BEFORE INSERT em eventos_financeiros: atribui id_interno atômico
CREATE OR REPLACE FUNCTION public.fn_eventos_financeiros_set_id_interno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq int;
BEGIN
  IF NEW.id_interno IS NOT NULL AND NEW.id_interno <> '' THEN
    RETURN NEW; -- já veio preenchido (import histórico)
  END IF;

  -- validação de formato AAAA-MM já é feita por validar_evento_financeiro
  INSERT INTO public.contadores_periodo (organization_id, mes_referencia, ultimo_numero, atualizado_em)
       VALUES (NEW.organization_id, NEW.mes_referencia, 1, now())
  ON CONFLICT (organization_id, mes_referencia)
  DO UPDATE SET
       ultimo_numero = public.contadores_periodo.ultimo_numero + 1,
       atualizado_em = now()
  RETURNING ultimo_numero INTO v_seq;

  NEW.id_interno := replace(NEW.mes_referencia, '-', '') || '-' || lpad(v_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eventos_financeiros_set_id_interno ON public.eventos_financeiros;
CREATE TRIGGER trg_eventos_financeiros_set_id_interno
  BEFORE INSERT ON public.eventos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_eventos_financeiros_set_id_interno();
