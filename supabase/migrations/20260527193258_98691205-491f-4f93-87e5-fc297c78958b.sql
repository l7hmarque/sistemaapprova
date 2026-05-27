
-- ============ FIX 1: leads — restringir a super_admin / staff ============
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

CREATE POLICY "Super admins can view leads"
ON public.leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete leads"
ON public.leads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Insert público continua (formulários do blog), via server function que usa supabaseAdmin.
-- Não criamos policy de INSERT para authenticated/anon: writes só via service_role.

-- ============ FIX 2: eventos_visita — leitura só super_admin ============
DROP POLICY IF EXISTS "Authenticated users can view all events" ON public.eventos_visita;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON public.eventos_visita;
DROP POLICY IF EXISTS "Anyone can view events" ON public.eventos_visita;

CREATE POLICY "Super admins can view visit events"
ON public.eventos_visita FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete visit events"
ON public.eventos_visita FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- ============ FIX 3: leads_rate_limit — só service_role ============
-- Tabela é tocada exclusivamente pelo server. Nenhuma policy = ninguém acessa via Data API.
-- Garante FORCE RLS para deixar explícito.
ALTER TABLE public.leads_rate_limit FORCE ROW LEVEL SECURITY;

-- ============ FIX 4: user_orgs — remover cascata para irmãs ============
-- Antes: retornava também todas as orgs filhas que compartilham o mesmo parent_organization_id.
-- Agora: retorna apenas as orgs onde o usuário é membro + filhas diretas das orgs onde ele é owner/admin (escritório-pai).
CREATE OR REPLACE FUNCTION public.user_orgs(_user_id uuid)
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = _user_id
  UNION
  SELECT o.id
  FROM public.organizations o
  WHERE o.parent_organization_id IN (
    SELECT om2.organization_id
    FROM public.organization_members om2
    WHERE om2.user_id = _user_id
      AND om2.role IN ('owner', 'admin')
  )
$$;

-- ============ FIX 5: storage policies — escopar por organização ============
-- Convenção de path: <organization_id>/<resto/do/caminho>
DROP POLICY IF EXISTS "Authenticated can read documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can write documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read prestacoes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can write prestacoes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update prestacoes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete prestacoes" ON storage.objects;
DROP POLICY IF EXISTS "documentos_read" ON storage.objects;
DROP POLICY IF EXISTS "documentos_write" ON storage.objects;
DROP POLICY IF EXISTS "documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;
DROP POLICY IF EXISTS "prestacoes_read" ON storage.objects;
DROP POLICY IF EXISTS "prestacoes_write" ON storage.objects;
DROP POLICY IF EXISTS "prestacoes_update" ON storage.objects;
DROP POLICY IF EXISTS "prestacoes_delete" ON storage.objects;

-- documentos: primeiro segmento do path = organization_id
CREATE POLICY "documentos_read_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
    )
  )
);

CREATE POLICY "documentos_write_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
);

CREATE POLICY "documentos_update_org"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
);

CREATE POLICY "documentos_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
);

-- prestacoes: mesmo padrão
CREATE POLICY "prestacoes_read_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prestacoes'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
    )
  )
);

CREATE POLICY "prestacoes_write_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prestacoes'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
);

CREATE POLICY "prestacoes_update_org"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'prestacoes'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
);

CREATE POLICY "prestacoes_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'prestacoes'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT organization_id FROM public.user_orgs(auth.uid()))
);
