-- ============================================================
-- MIGRATION: add_odometer_km_checklists
-- Adiciona o campo hodômetro ao checklist para rastrear o Km
-- do veículo no momento de cada preenchimento.
-- ============================================================

ALTER TABLE checklists
  ADD COLUMN IF NOT EXISTS odometer_km INTEGER NULL;
