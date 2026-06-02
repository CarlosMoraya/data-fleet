-- ============================================================
-- MIGRATION: fix_admin_master_rls_regression
-- Descricao: remove subconsultas RLS-circulares de policies que
-- afetam Admin Master em Dashboard, Veiculos e Oficinas.
--
-- Contexto:
-- - Policies com OR podem ter subconsultas avaliadas pelo planner
--   mesmo quando outro ramo autorizaria Admin Master.
-- - Subconsultas em vehicles -> maintenance_orders -> workshops
--   e workshops -> workshop_schedules/maintenance_orders
--   causavam 500 por recursao/avaliacao indireta de RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.workshop_profile_can_access_vehicle_id(
  target_profile_id UUID,
  target_vehicle_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.maintenance_orders mo
    JOIN public.workshops w ON w.id = mo.workshop_id
    WHERE mo.vehicle_id = target_vehicle_id
      AND w.profile_id = target_profile_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.maintenance_orders mo
    JOIN public.workshop_partnerships wp
      ON wp.legacy_workshop_id = mo.workshop_id
     AND wp.status = 'active'
    JOIN public.workshop_accounts wa
      ON wa.id = wp.workshop_account_id
    WHERE mo.vehicle_id = target_vehicle_id
      AND wa.profile_id = target_profile_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.workshop_profile_can_access_maintenance_order_id(
  target_profile_id UUID,
  target_maintenance_order_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.maintenance_orders mo
    JOIN public.workshops w ON w.id = mo.workshop_id
    WHERE mo.id = target_maintenance_order_id
      AND w.profile_id = target_profile_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.maintenance_orders mo
    JOIN public.workshop_partnerships wp
      ON wp.legacy_workshop_id = mo.workshop_id
     AND wp.status = 'active'
    JOIN public.workshop_accounts wa
      ON wa.id = wp.workshop_account_id
    WHERE mo.id = target_maintenance_order_id
      AND wa.profile_id = target_profile_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.operations_manager_can_access_workshop_id(
  target_profile_id UUID,
  target_workshop_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workshop_schedules ws
    WHERE ws.workshop_id = target_workshop_id
      AND public.operations_manager_can_access_vehicle_id(target_profile_id, ws.vehicle_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.maintenance_orders mo
    WHERE mo.workshop_id = target_workshop_id
      AND public.operations_manager_can_access_vehicle_id(target_profile_id, mo.vehicle_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_tenant_select" ON public.vehicles;
DROP POLICY IF EXISTS "tenant_read_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Enable read for users based on client_id" ON public.vehicles;

CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'Fleet Assistant',
        'Fleet Analyst',
        'Supervisor',
        'Coordinator',
        'Manager',
        'Director'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), id)
    )
  );

DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_orders;
CREATE POLICY "maintenance_select" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'Fleet Assistant',
        'Fleet Analyst',
        'Supervisor',
        'Coordinator',
        'Manager',
        'Director'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND public.workshop_profile_can_access_maintenance_order_id(auth.uid(), id)
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
  );

DROP POLICY IF EXISTS "vehicles_select_auditor" ON public.vehicles;
CREATE POLICY "vehicles_select_auditor" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Yard Auditor'
  );

DROP POLICY IF EXISTS "vehicles_select_own_driver" ON public.vehicles;
CREATE POLICY "vehicles_select_own_driver" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Driver'
    AND public.driver_can_access_vehicle_id(auth.uid(), id)
  );

DROP POLICY IF EXISTS "workshop_vehicle_select" ON public.vehicles;
CREATE POLICY "workshop_vehicle_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
    AND public.workshop_profile_can_access_vehicle_id(auth.uid(), id)
  );

DROP POLICY IF EXISTS "workshops_select" ON public.workshops;
CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'Driver',
        'Yard Auditor',
        'Fleet Assistant',
        'Fleet Analyst',
        'Supervisor',
        'Coordinator',
        'Manager',
        'Director'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND profile_id = auth.uid()
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND id IN (
        SELECT wp.legacy_workshop_id
        FROM public.workshop_partnerships wp
        JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
        WHERE wa.profile_id = auth.uid()
          AND wp.status = 'active'
          AND wp.legacy_workshop_id IS NOT NULL
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_workshop_id(auth.uid(), id)
    )
  );
