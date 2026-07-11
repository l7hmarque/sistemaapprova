
-- Milestone 1 — Blindagem multi-tenant, auditoria e id_interno auditável

-- 1.1 Remove DEFAULT current_user_org() de todas as colunas organization_id
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='organization_id'
       AND column_default LIKE '%current_user_org%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id DROP DEFAULT', r.table_name);
  END LOOP;
END $$;

-- 1.2 Auditoria genérica em tabelas críticas (idempotente)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['eventos_financeiros','fornecedores','configuracoes','prestacao_documentos','regras_despesa'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s
         AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row()', t);
  END LOOP;
END $$;

-- Índice parcial para leituras filtrando excluidos
CREATE INDEX IF NOT EXISTS idx_eventos_financeiros_ativos
  ON public.eventos_financeiros (organization_id, mes_referencia)
  WHERE excluido_em IS NULL;

-- 1.3 id_interno passa a 'YYYYMM-NNNN'
CREATE OR REPLACE FUNCTION public.fn_eventos_financeiros_set_id_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seq int;
  v_ym  text;
BEGIN
  IF NEW.id_interno IS NOT NULL AND NEW.id_interno <> '' AND NEW.id_interno ~ '^[0-9]{6}-[0-9]{4}$' THEN
    RETURN NEW;
  END IF;

  v_ym := replace(NEW.mes_referencia, '-', ''); -- 'YYYY-MM' -> 'YYYYMM'

  INSERT INTO public.contadores_periodo (organization_id, mes_referencia, ultimo_numero, atualizado_em)
       VALUES (NEW.organization_id, NEW.mes_referencia, 1, now())
  ON CONFLICT (organization_id, mes_referencia)
  DO UPDATE SET
       ultimo_numero = public.contadores_periodo.ultimo_numero + 1,
       atualizado_em = now()
  RETURNING ultimo_numero INTO v_seq;

  NEW.id_interno := v_ym || '-' || lpad(v_seq::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- Backfill dos ids existentes 'NNNN' -> 'YYYYMM-NNNN' preservando o número
UPDATE public.eventos_financeiros
   SET id_interno = replace(mes_referencia, '-', '') || '-' || id_interno
 WHERE id_interno ~ '^[0-9]{4}$'
   AND mes_referencia ~ '^[0-9]{4}-[0-9]{2}$';
