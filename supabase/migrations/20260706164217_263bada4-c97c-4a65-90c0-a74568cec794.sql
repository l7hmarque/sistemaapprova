
-- 1) Simplifica o formato do ID interno: apenas o sequencial (0001, 0002…)
CREATE OR REPLACE FUNCTION public.fn_eventos_financeiros_set_id_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seq int;
BEGIN
  IF NEW.id_interno IS NOT NULL AND NEW.id_interno <> '' THEN
    RETURN NEW; -- já veio preenchido (import histórico)
  END IF;

  INSERT INTO public.contadores_periodo (organization_id, mes_referencia, ultimo_numero, atualizado_em)
       VALUES (NEW.organization_id, NEW.mes_referencia, 1, now())
  ON CONFLICT (organization_id, mes_referencia)
  DO UPDATE SET
       ultimo_numero = public.contadores_periodo.ultimo_numero + 1,
       atualizado_em = now()
  RETURNING ultimo_numero INTO v_seq;

  NEW.id_interno := lpad(v_seq::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- 2) Tabela de regras de despesa por organização
CREATE TABLE public.regras_despesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  prioridade int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  -- Match (qualquer combinação)
  match_tp_despesa int,
  match_tp_documento int,
  match_favorecido_regex text,
  -- Defaults aplicados
  set_cd_modalidade int,
  set_tp_documento_pagamento int,
  set_tp_documento_favorecido text,
  set_nr_documento_favorecido text,
  set_nm_favorecido text,
  set_tp_despesa int,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX regras_despesa_org_prio_idx
  ON public.regras_despesa (organization_id, prioridade)
  WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_despesa TO authenticated;
GRANT ALL ON public.regras_despesa TO service_role;

ALTER TABLE public.regras_despesa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem regras da própria org"
  ON public.regras_despesa FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE POLICY "Membros gerenciam regras da própria org"
  ON public.regras_despesa FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE TRIGGER trg_regras_despesa_touch
  BEFORE UPDATE ON public.regras_despesa
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- 3) Seed inicial de regras federais para orgs existentes
INSERT INTO public.regras_despesa
  (organization_id, nome, prioridade, ativo, match_tp_documento,
   set_tp_documento_favorecido, set_nr_documento_favorecido, set_nm_favorecido, set_cd_modalidade)
SELECT o.id, 'DARF — Federal', 10, true, 7,
       'CNPJ', '00394460000141', 'MINISTERIO DA FAZENDA - MATRIZ', 100
  FROM public.organizations o
 WHERE NOT EXISTS (
   SELECT 1 FROM public.regras_despesa r
    WHERE r.organization_id = o.id AND r.match_tp_documento = 7
 );

INSERT INTO public.regras_despesa
  (organization_id, nome, prioridade, ativo, match_tp_documento,
   set_tp_documento_favorecido, set_nr_documento_favorecido, set_nm_favorecido, set_cd_modalidade)
SELECT o.id, 'GPS — INSS', 10, true, 9,
       'CNPJ', '16727230000197', 'FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL', 100
  FROM public.organizations o
 WHERE NOT EXISTS (
   SELECT 1 FROM public.regras_despesa r
    WHERE r.organization_id = o.id AND r.match_tp_documento = 9
 );

INSERT INTO public.regras_despesa
  (organization_id, nome, prioridade, ativo, match_tp_documento,
   set_tp_documento_favorecido, set_nr_documento_favorecido, set_nm_favorecido, set_cd_modalidade)
SELECT o.id, 'GFIP — FGTS', 10, true, 10,
       'CNPJ', '00360305000104', 'CAIXA ECONOMICA FEDERAL', 100
  FROM public.organizations o
 WHERE NOT EXISTS (
   SELECT 1 FROM public.regras_despesa r
    WHERE r.organization_id = o.id AND r.match_tp_documento = 10
 );

-- Regra padrão: REO 3.3.90.39.99 → Modalidade 101 (Pesquisa de Preços)
INSERT INTO public.regras_despesa
  (organization_id, nome, prioridade, ativo, match_tp_despesa, set_cd_modalidade)
SELECT o.id, 'Outros serviços PJ → Pesquisa de Preços', 50, true, 271, 101
  FROM public.organizations o
 WHERE NOT EXISTS (
   SELECT 1 FROM public.regras_despesa r
    WHERE r.organization_id = o.id
      AND r.match_tp_despesa = 271
      AND r.set_cd_modalidade = 101
 );
