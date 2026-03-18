-- ============================================================
-- MIGRATION: fix_maintenance_orders_admin_master_rls
-- Descrição: As policies originais de maintenance_orders
--            filtravam apenas por role_rank >= 3 AND client_id
--            matching, bloqueando Admin Master ao tentar inserir
--            ou visualizar ordens de manutenção de outros tenants.
--
--            Solução: recriar todas as policies incluindo cláusula
--            especial para Admin Master (sem restrição de client_id).
-- ============================================================

-- Remove policies antigas
DROP POLICY IF EXISTS "tenant_assistant_read_maintenance" ON public.maintenance_orders;
DROP POLICY IF EXISTS "tenant_assistant_write_maintenance" ON public.maintenance_orders;
DROP POLICY IF EXISTS "tenant_assistant_update_maintenance" ON public.maintenance_orders;
DROP POLICY IF EXISTS "tenant_manager_delete_maintenance" ON public.maintenance_orders;

-- SELECT: Fleet Assistant+ do próprio tenant OU Admin Master (cross-tenant)
CREATE POLICY "maintenance_select" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- INSERT: Fleet Assistant+ do próprio tenant OU Admin Master
CREATE POLICY "maintenance_insert" ON public.maintenance_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- UPDATE: Fleet Assistant+ do próprio tenant OU Admin Master
CREATE POLICY "maintenance_update" ON public.maintenance_orders
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  )
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- DELETE: Manager+ do próprio tenant OU Admin Master
CREATE POLICY "maintenance_delete" ON public.maintenance_orders
  FOR DELETE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 5
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );
