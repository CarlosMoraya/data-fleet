-- ============================================================
-- MIGRATION: add_driver_vehicle_association
-- Data: 2026-03-11
-- Descrição: Adiciona coluna driver_id na tabela vehicles para
--            associar um motorista a um veículo (relação 1:1).
--            Um motorista só pode estar vinculado a 1 veículo.
-- ============================================================

-- 1. Adicionar coluna driver_id (nullable FK → drivers)
--    ON DELETE SET NULL: se o motorista for excluído, o veículo
--    fica com driver_id = null automaticamente.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;

-- 2. Índice único parcial: garante que um motorista está em no máximo 1 veículo.
--    WHERE driver_id IS NOT NULL permite múltiplos veículos sem motorista.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_driver_unique
  ON vehicles(driver_id)
  WHERE driver_id IS NOT NULL;
