-- ============================================================
-- MIGRATION: fix_operations_manager_schedule_rls
-- Descricao: remove o Operations Manager dos blocos tenant-wide
-- baseados em rank e evita subqueries RLS em vehicles dentro da
-- policy de workshop_schedules.
-- ============================================================

CREATE OR REPLACE FUNCTION public.operations_manager_can_access_vehicle_id(
  target_profile_id UUID,
  target_vehicle_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = target_vehicle_id
      AND v.shipper_id IS NOT NULL
      AND v.operational_unit_id IS NOT NULL
      AND public.operations_manager_has_shipper_scope(target_profile_id, v.shipper_id)
      AND public.operations_manager_has_operational_unit_scope(target_profile_id, v.operational_unit_id)
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
      AND public.operations_manager_can_access_vehicle(auth.uid(), shipper_id, operational_unit_id)
    )
  );

DROP POLICY IF EXISTS "ws_schedules_select" ON public.workshop_schedules;
CREATE POLICY "ws_schedules_select" ON public.workshop_schedules
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
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Driver'
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND vehicle_id IN (
        SELECT v.id
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.driver_id AND d.client_id = v.client_id
        WHERE d.profile_id = auth.uid()
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
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
      AND workshop_id IN (
        SELECT id FROM public.workshops WHERE profile_id = auth.uid()
        UNION
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
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
  );
