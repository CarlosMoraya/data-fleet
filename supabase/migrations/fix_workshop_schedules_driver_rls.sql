-- ============================================================
-- FIX: RLS policy ws_schedules_select para Driver
-- Problema: a policy original usava auth.uid() dentro de EXISTS
-- aninhado em IN (SELECT p.id ...), causando falha silenciosa.
-- Solução: reescrever com estrutura mais simples e direta.
-- ============================================================

-- Remove policy antiga
DROP POLICY IF EXISTS "ws_schedules_select" ON public.workshop_schedules;

-- Recria com lógica separada por caso:
-- 1) Fleet Assistant+ do mesmo tenant
-- 2) Driver que tem o veículo agendado
-- 3) Admin Master
CREATE POLICY "ws_schedules_select" ON public.workshop_schedules
  FOR SELECT TO authenticated
  USING (
    -- Fleet Assistant+ (rank 3+) do mesmo tenant
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR
    -- Admin Master vê tudo
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR
    -- Driver: apenas agendamentos do seu próprio veículo
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Driver'
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND vehicle_id IN (
        SELECT v.id
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.driver_id AND d.client_id = v.client_id
        WHERE d.profile_id = auth.uid()
      )
    )
  );
