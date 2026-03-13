-- Adiciona campos de garantia, revisão, seguro e contrato de manutenção à tabela vehicles
-- Execute no Supabase Dashboard → SQL Editor

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS warranty BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_end_date DATE NULL,
  ADD COLUMN IF NOT EXISTS first_revision_max_km INTEGER NULL,
  ADD COLUMN IF NOT EXISTS first_revision_deadline DATE NULL,
  ADD COLUMN IF NOT EXISTS cooling_first_revision_deadline DATE NULL,
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_policy_upload TEXT NULL,
  ADD COLUMN IF NOT EXISTS has_maintenance_contract BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_contract_upload TEXT NULL;

-- Adiciona colunas de configuração de campos opcionais à tabela vehicle_field_settings
ALTER TABLE vehicle_field_settings
  ADD COLUMN IF NOT EXISTS warranty_end_date_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_revision_max_km_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_revision_deadline_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooling_first_revision_deadline_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_policy_upload_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_contract_upload_optional BOOLEAN NOT NULL DEFAULT false;
