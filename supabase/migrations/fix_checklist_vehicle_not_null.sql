-- ============================================================
-- Garante que todo checklist tem um veículo associado.
-- ATENÇÃO: o DELETE abaixo remove checklists com vehicle_id NULL.
-- Confirme que esses registros podem ser descartados antes de executar.
-- Executar no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Remove checklists órfãos (sem veículo)
DELETE FROM public.checklists WHERE vehicle_id IS NULL;

-- 2. Remove constraint antiga (ON DELETE SET NULL)
ALTER TABLE public.checklists
  DROP CONSTRAINT IF EXISTS checklists_vehicle_id_fkey;

-- 3. Adiciona NOT NULL + nova FK com ON DELETE RESTRICT
--    (impede excluir veículo que tenha checklists vinculados)
ALTER TABLE public.checklists
  ALTER COLUMN vehicle_id SET NOT NULL,
  ADD CONSTRAINT checklists_vehicle_id_fkey
    FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;
