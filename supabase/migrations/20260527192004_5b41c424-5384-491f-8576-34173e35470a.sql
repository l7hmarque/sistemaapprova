
-- Função: org ativa do usuário corrente (primeira membership encontrada)
CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id
    FROM public.organization_members
   WHERE user_id = auth.uid()
   ORDER BY criado_em ASC
   LIMIT 1;
$$;

-- Aplica DEFAULT em todas as tabelas operacionais
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cotacoes','convites_cotacao','cotacao_presets','orcamentos_salvos','orcamento_presets',
    'objetos_cotacao','fornecedores','eventos_agenda','eventos_financeiros','documentos_anexos',
    'extracoes_salvas','modelos_planilha','prestacoes_snapshot','prestacao_documentos','configuracoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.current_user_org()', t);
  END LOOP;
END $$;

-- Hardening do linter: restringe EXECUTE das funções SECURITY DEFINER a authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_orgs(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_org() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_orgs(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated, service_role;
