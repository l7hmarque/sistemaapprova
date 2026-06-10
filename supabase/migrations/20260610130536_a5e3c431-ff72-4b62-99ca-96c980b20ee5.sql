CREATE TABLE public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_api_key text NOT NULL,
  google_email text,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_connections TO authenticated;
GRANT ALL ON public.google_connections TO service_role;

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read google connection"
  ON public.google_connections FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE POLICY "org admins can insert google connection"
  ON public.google_connections FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "org admins can update google connection"
  ON public.google_connections FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id))
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "org admins can delete google connection"
  ON public.google_connections FOR DELETE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

CREATE TRIGGER trg_google_connections_updated
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();