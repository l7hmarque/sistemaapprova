
-- P0 multi-tenancy
ALTER TABLE public.fornecedores DROP CONSTRAINT IF EXISTS fornecedores_cnpj_key;
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_org_cnpj_key
  ON public.fornecedores (organization_id, cnpj);

CREATE UNIQUE INDEX IF NOT EXISTS objetos_cotacao_org_descricao_key
  ON public.objetos_cotacao (organization_id, lower(descricao));

CREATE UNIQUE INDEX IF NOT EXISTS modelos_planilha_org_nome_tipo_key
  ON public.modelos_planilha (organization_id, tipo, nome);

-- prestacoes_snapshot: adiciona revisão e enforce unicidade por (org, mês, revisão)
ALTER TABLE public.prestacoes_snapshot
  ADD COLUMN IF NOT EXISTS revisao integer NOT NULL DEFAULT 1;

-- backfill revisões pra duplicatas existentes
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY organization_id, mes_referencia ORDER BY gerado_em) AS rn
  FROM public.prestacoes_snapshot
)
UPDATE public.prestacoes_snapshot s
SET revisao = r.rn
FROM ranked r
WHERE s.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS prestacoes_snapshot_org_mes_rev_key
  ON public.prestacoes_snapshot (organization_id, mes_referencia, revisao);

-- P0 analytics leak
DROP POLICY IF EXISTS auth_can_view_eventos_visita ON public.eventos_visita;
DROP POLICY IF EXISTS auth_can_delete_eventos_visita ON public.eventos_visita;

-- P1 validações em eventos_financeiros
CREATE OR REPLACE FUNCTION public.validar_evento_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.valor_previsto IS NOT NULL AND NEW.valor_previsto < 0 THEN
    RAISE EXCEPTION 'valor_previsto não pode ser negativo';
  END IF;
  IF NEW.valor_efetivo IS NOT NULL AND NEW.valor_efetivo < 0 THEN
    RAISE EXCEPTION 'valor_efetivo não pode ser negativo';
  END IF;
  IF NEW.data_pagamento IS NOT NULL AND NEW.data_vencimento IS NOT NULL
     AND NEW.data_pagamento < NEW.data_vencimento - INTERVAL '365 days' THEN
    RAISE EXCEPTION 'data_pagamento muito anterior ao vencimento';
  END IF;
  IF NEW.mes_referencia !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'mes_referencia inválido: use AAAA-MM';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_evento_financeiro ON public.eventos_financeiros;
CREATE TRIGGER trg_validar_evento_financeiro
  BEFORE INSERT OR UPDATE ON public.eventos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.validar_evento_financeiro();
