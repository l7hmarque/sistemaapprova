-- 1) Dedup id_interno existentes por org antes de criar índice único
UPDATE public.eventos_financeiros e
SET id_interno = e.id_interno || '-' || substr(md5(e.id::text), 1, 6)
WHERE e.id_interno IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.eventos_financeiros e2
    WHERE e2.organization_id = e.organization_id
      AND e2.id_interno = e.id_interno
      AND e2.id <> e.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_org_id_interno
  ON public.eventos_financeiros(organization_id, id_interno)
  WHERE id_interno IS NOT NULL;

-- 2) Trigger de signup: cria organização + membership owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  nome_org text;
BEGIN
  nome_org := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'organization_name',''),
    NULLIF(NEW.raw_user_meta_data->>'full_name',''),
    split_part(NEW.email, '@', 1),
    'Minha organização'
  );

  INSERT INTO public.organizations (nome, slug)
  VALUES (nome_org, 'org-' || substr(md5(NEW.id::text), 1, 10))
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Tabela de convites de membro para a organização
CREATE TABLE IF NOT EXISTS public.convites_membro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  token text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  aceito_em timestamptz,
  aceito_por uuid,
  convidado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_membro_org ON public.convites_membro(organization_id);
CREATE INDEX IF NOT EXISTS idx_convites_membro_email ON public.convites_membro(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites_membro TO authenticated;
GRANT ALL ON public.convites_membro TO service_role;

ALTER TABLE public.convites_membro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins veem convites da própria org"
  ON public.convites_membro FOR SELECT
  TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "Owners/admins criam convites"
  ON public.convites_membro FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_owner(auth.uid(), organization_id)
    AND convidado_por = auth.uid()
  );

CREATE POLICY "Owners/admins atualizam convites"
  ON public.convites_membro FOR UPDATE
  TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "Owners/admins deletam convites"
  ON public.convites_membro FOR DELETE
  TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));