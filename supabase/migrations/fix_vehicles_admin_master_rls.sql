-- ============================================================
-- MIGRATION: fix_vehicles_admin_master_rls
-- Descrição: Admin Master tem client_id = NULL no profile.
--            A policy SELECT original de vehicles usava
--            client_id = get_my_client_id() sem tratar o caso
--            de Admin Master, resultando em 0 veículos retornados.
--
--            Solução: recriar a policy SELECT incluindo cláusula
--            especial para Admin Master (cross-tenant, sem restrição
--            de client_id), idêntica ao padrão de maintenance_orders.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- Remove políticas existentes de SELECT (tenta nomes comuns)
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_tenant_select" ON public.vehicles;
DROP POLICY IF EXISTS "tenant_read_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Enable read for users based on client_id" ON public.vehicles;

-- SELECT: Fleet Assistant(3)+ do próprio tenant OU Admin Master (cross-tenant)
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );
