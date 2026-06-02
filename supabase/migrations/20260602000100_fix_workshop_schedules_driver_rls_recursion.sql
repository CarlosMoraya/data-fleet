-- ============================================================
-- MIGRATION: fix_workshop_schedules_driver_rls_recursion
-- Descricao: remove a subquery direta em vehicles de dentro da
-- policy de workshop_schedules. Mesmo em ramos de OR que nao
-- autorizam o usuario atual, o planner pode avaliar subqueries e
-- acionar RLS recursiva em vehicles.
-- ============================================================

CREATE OR REPLACE FUNCTION public.driver_can_access_vehicle_id(
  target_profile_id UUID,
  target_vehicle_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.vehicles v
      ON v.driver_id = d.id
     AND v.client_id = d.client_id
    WHERE d.profile_id = target_profile_id
      AND v.id = target_vehicle_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

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
      AND public.driver_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
  );
