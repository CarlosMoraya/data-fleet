-- ============================================================
-- MIGRATION: add_initial_km_vehicles
-- Adiciona o campo km inicial ao veículo e seu toggle de
-- obrigatoriedade na tabela de configurações de campos.
-- ============================================================

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS initial_km INTEGER NULL;

ALTER TABLE vehicle_field_settings
  ADD COLUMN IF NOT EXISTS initial_km_optional BOOLEAN NOT NULL DEFAULT false;
