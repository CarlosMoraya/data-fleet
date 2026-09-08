-- Rollback de 20260908000100_restrict_profile_delete_to_admin_master.sql
-- Recria a policy com a definicao exata que ela tinha em producao.

DROP POLICY IF EXISTS "tenant_managers_delete_profiles" ON public.profiles;
CREATE POLICY "tenant_managers_delete_profiles" ON public.profiles
  FOR DELETE USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(role) < public.role_rank(public.get_my_role())
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
  );

NOTIFY pgrst, 'reload schema';
