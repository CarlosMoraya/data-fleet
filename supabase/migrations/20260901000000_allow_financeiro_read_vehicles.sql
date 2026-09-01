-- ============================================================
-- MIGRATION: allow_financeiro_read_vehicles
-- Data: 2026-09-01
-- Descrição: O papel 'Financeiro' passa a ler veículos do mesmo
--            tenant para que a placa seja exibida nos pagamentos.
--            Esta migration apenas acrescenta 'Financeiro' à
--            lista de papéis já existente em vehicles_select.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
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
        'Director',
        'Financeiro'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), id)
    )
  );

NOTIFY pgrst, 'reload schema';
