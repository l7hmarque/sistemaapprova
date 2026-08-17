-- Revoga execução direta de funções internas (gatilhos e rotinas de manutenção)
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_eventos_financeiros_set_id_interno() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_eventos_financeiros_soft_delete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_lock_snapshot_anexos() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_lock_snapshot_eventos() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_atualizado_em() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_modelos_planilha() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_evento_financeiro() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.drive_queue_claim(integer) FROM anon, authenticated;

-- Funções realmente usadas pelo app: só para usuários autenticados
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_org() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_orgs(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_orgs(uuid) TO authenticated;