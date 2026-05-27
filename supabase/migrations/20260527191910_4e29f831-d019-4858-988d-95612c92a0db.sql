
-- ============================================================
-- 1) ENUMs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin','org_owner','org_admin','org_member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_tipo AS ENUM ('osc','escritorio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('trial','ativo','suspenso','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('owner','admin','membro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2) organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  tipo public.org_tipo NOT NULL DEFAULT 'osc',
  parent_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  plano text NOT NULL DEFAULT 'essencial',
  status public.org_status NOT NULL DEFAULT 'trial',
  trial_ate date DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  cobranca_externa boolean NOT NULL DEFAULT true,
  stripe_customer_id text,
  stripe_subscription_id text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orgs_parent ON public.organizations(parent_organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3) organization_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_member_role NOT NULL DEFAULT 'membro',
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4) user_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5) Funções SECURITY DEFINER (evitam recursão)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Retorna todas as organizations que o usuário acessa
-- (membro direto + filhas dos escritórios em que é membro)
CREATE OR REPLACE FUNCTION public.user_orgs(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT om.organization_id
    FROM public.organization_members om
   WHERE om.user_id = _user_id
  UNION
  SELECT o.id
    FROM public.organizations o
    JOIN public.organization_members om
      ON om.organization_id = o.parent_organization_id
   WHERE om.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner','admin')
  );
$$;

-- ============================================================
-- 6) support_tickets, audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  resposta text,
  respondido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid,
  acao text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7) Adiciona organization_id em tabelas operacionais
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cotacoes','convites_cotacao','cotacao_presets','orcamentos_salvos','orcamento_presets',
    'objetos_cotacao','fornecedores','eventos_agenda','eventos_financeiros','documentos_anexos',
    'extracoes_salvas','modelos_planilha','prestacoes_snapshot','prestacao_documentos','configuracoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org ON public.%I(organization_id)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 8) Seed: organização "CAIA Medianeira" + Leonardo super_admin
-- ============================================================
DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid := 'b6153c1a-2552-496b-9eeb-dd2a5b38a177';
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE nome = 'CAIA Medianeira' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (nome, tipo, status, plano, trial_ate, observacoes)
    VALUES ('CAIA Medianeira', 'osc', 'ativo', 'completo', NULL, 'Organização semente — dados originais do sistema')
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT DO NOTHING;

  -- Backfill: associa todos os dados existentes à org semente
  UPDATE public.cotacoes            SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.convites_cotacao    SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.cotacao_presets     SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.orcamentos_salvos   SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.orcamento_presets   SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.objetos_cotacao     SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.fornecedores        SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.eventos_agenda      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.eventos_financeiros SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.documentos_anexos   SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.extracoes_salvas    SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.modelos_planilha    SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.prestacoes_snapshot SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.prestacao_documentos SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.configuracoes       SET organization_id = v_org_id WHERE organization_id IS NULL;
END $$;

-- ============================================================
-- 9) Torna organization_id NOT NULL nas tabelas operacionais
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cotacoes','convites_cotacao','cotacao_presets','orcamentos_salvos','orcamento_presets',
    'objetos_cotacao','fornecedores','eventos_agenda','eventos_financeiros','documentos_anexos',
    'extracoes_salvas','modelos_planilha','prestacoes_snapshot','prestacao_documentos','configuracoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
  END LOOP;
END $$;

-- ============================================================
-- 10) Reescreve RLS: drop policies antigas "USING (true)" e cria escopo por org
-- ============================================================
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cotacoes','convites_cotacao','cotacao_presets','orcamentos_salvos','orcamento_presets',
    'objetos_cotacao','fornecedores','eventos_agenda','eventos_financeiros','documentos_anexos',
    'extracoes_salvas','modelos_planilha','prestacoes_snapshot','prestacao_documentos','configuracoes'
  ] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY "org_select" ON public.%I FOR SELECT TO authenticated
      USING (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "org_insert" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "org_update" ON public.%I FOR UPDATE TO authenticated
      USING (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'))
      WITH CHECK (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "org_delete" ON public.%I FOR DELETE TO authenticated
      USING (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'))
    $f$, t);
  END LOOP;
END $$;

-- ============================================================
-- 11) RLS para organizations, organization_members, user_roles, support_tickets, audit_log
-- ============================================================
CREATE POLICY "orgs_select" ON public.organizations FOR SELECT TO authenticated
USING (id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "orgs_update" ON public.organizations FOR UPDATE TO authenticated
USING (public.is_org_owner(auth.uid(), id) OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.is_org_owner(auth.uid(), id) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "orgs_insert_super" ON public.organizations FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "orgs_delete_super" ON public.organizations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "members_select" ON public.organization_members FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "members_modify" ON public.organization_members FOR ALL TO authenticated
USING (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "roles_super_only" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "tickets_select" ON public.support_tickets FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "tickets_insert" ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT public.user_orgs(auth.uid())));
CREATE POLICY "tickets_update" ON public.support_tickets FOR UPDATE TO authenticated
USING (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "audit_select" ON public.audit_log FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT public.user_orgs(auth.uid())) OR public.has_role(auth.uid(),'super_admin'));

-- ============================================================
-- 12) Triggers de atualizado_em
-- ============================================================
DROP TRIGGER IF EXISTS trg_orgs_touch ON public.organizations;
CREATE TRIGGER trg_orgs_touch BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS trg_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_tickets_touch BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();
