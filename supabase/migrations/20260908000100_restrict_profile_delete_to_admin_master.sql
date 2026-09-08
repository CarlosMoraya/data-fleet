-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- Remove a policy que permitia a qualquer perfil de rank >= Fleet Assistant
-- excluir perfis inferiores do proprio tenant direto pela API PostgREST.
-- Apos esta migration, apenas admin_master_delete_profiles permanece.
--
-- Seguro: nenhum ponto de src/ executa DELETE em profiles. A exclusao no
-- produto passa pelas Edge Functions create-user (acao delete) e delete-user,
-- que rodam com service_role e nao sao governadas por RLS.

DROP POLICY IF EXISTS "tenant_managers_delete_profiles" ON public.profiles;

NOTIFY pgrst, 'reload schema';
