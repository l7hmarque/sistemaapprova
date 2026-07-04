
DROP POLICY IF EXISTS org_update ON public.eventos_financeiros;
CREATE POLICY org_update ON public.eventos_financeiros
  FOR UPDATE
  USING (
    (
      (organization_id IN (SELECT user_orgs(auth.uid())))
      AND excluido_em IS NULL
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (organization_id IN (SELECT user_orgs(auth.uid())))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
