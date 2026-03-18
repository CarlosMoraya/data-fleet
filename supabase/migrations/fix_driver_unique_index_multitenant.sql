-- ============================================================
-- MIGRATION: fix_driver_unique_index_multitenant
-- Descrição: Corrige o índice UNIQUE em driver_id para ser
--            scoped por client_id, permitindo que cada cliente
--            tenha seu próprio motorista vinculado a 1 veículo.
-- ============================================================

-- 1. Remove o índice global quebrado (viola multi-tenancy)
DROP INDEX IF EXISTS public.idx_vehicles_driver_unique;

-- 2. Cria novo índice scoped por client_id
--    Permite: cada cliente pode ter 1 motorista/veículo
--    Bloqueia: 1 motorista em múltiplos veículos do MESMO cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_client_driver_unique
  ON public.vehicles(client_id, driver_id)
  WHERE driver_id IS NOT NULL;
