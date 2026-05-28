
-- Drop broad storage policies on 'documentos' bucket
DROP POLICY IF EXISTS "auth read documentos" ON storage.objects;
DROP POLICY IF EXISTS "auth insert documentos" ON storage.objects;
DROP POLICY IF EXISTS "auth update documentos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete documentos" ON storage.objects;
DROP POLICY IF EXISTS "auth read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "auth upload comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "auth delete comprovantes" ON storage.objects;

-- Drop broad storage policies on 'prestacoes' bucket
DROP POLICY IF EXISTS "auth_view_prestacoes_objects" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_prestacoes_objects" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_prestacoes_objects" ON storage.objects;

-- Drop permissive leads policies
DROP POLICY IF EXISTS "auth_view_leads" ON public.leads;
DROP POLICY IF EXISTS "auth_update_leads" ON public.leads;

-- Add restrictive policy to leads_rate_limit (service role only; bypasses RLS)
CREATE POLICY "leads_rate_limit_no_client_access"
ON public.leads_rate_limit
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
