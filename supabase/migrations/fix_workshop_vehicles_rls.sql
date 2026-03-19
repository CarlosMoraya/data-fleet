-- ============================================================
-- MIGRATION: fix_workshop_vehicles_rls
-- Descrição: Usuários com role 'Workshop' não conseguiam ver
--            a placa do veículo na tela de Manutenção porque
--            não tinham acesso de SELECT na tabela vehicles.
--            O join `vehicles (license_plate)` retornava null
--            e o mapper exibia 'N/A'.
--
--            Solução: adicionar policy SELECT para Workshop
--            restrita aos veículos presentes em suas próprias OS.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "workshop_vehicle_select" ON public.vehicles;

CREATE POLICY "workshop_vehicle_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
    AND id IN (
      SELECT mo.vehicle_id
      FROM public.maintenance_orders mo
      JOIN public.workshops w ON w.id = mo.workshop_id
      WHERE w.profile_id = auth.uid()
    )
  );
