-- =============================================================================
-- 20260907000000_add_vehicle_is_dedicated.sql
--
-- Módulo Utilização MELI — Etapa 0.
-- Coluna `is_dedicated` em `vehicles`: aditiva, não-destrutiva, default false.
--
-- APLICAR EM: DEV e PROD (esta é a única das quatro que roda nos dois).
-- ORDEM: primeira. As migrations 0001, 0002 e 0003 dependem desta coluna.
--
-- RLS: nada a fazer. `vehicles` já tem policies por `client_id`, e coluna nova
-- é coberta por elas automaticamente.
-- =============================================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_dedicated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vehicles.is_dedicated IS
  'Veículo dedicado ao embarcador. Usado pelo módulo Utilização MELI.';

CREATE INDEX IF NOT EXISTS idx_vehicles_shipper_dedicated
  ON public.vehicles (client_id, shipper_id, is_dedicated)
  WHERE is_dedicated = true;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- CONFERÊNCIA (rodar após aplicar; esperado: 1 linha)
-- =============================================================================
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'vehicles' AND column_name = 'is_dedicated';

-- =============================================================================
-- ROLLBACK (só se necessário — descarta o valor de todos os veículos)
-- =============================================================================
-- DROP INDEX IF EXISTS public.idx_vehicles_shipper_dedicated;
-- ALTER TABLE public.vehicles DROP COLUMN IF EXISTS is_dedicated;
-- NOTIFY pgrst, 'reload schema';
