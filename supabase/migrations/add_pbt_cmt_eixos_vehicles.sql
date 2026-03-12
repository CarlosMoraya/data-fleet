-- Migration: Adicionar campos PBT, CMT e Eixos ao veículo
-- Execute no Supabase Dashboard > SQL Editor

-- Novos campos na tabela vehicles
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS pbt real DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cmt real DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS eixos integer DEFAULT NULL;

-- Novos toggles de obrigatoriedade na tabela vehicle_field_settings
ALTER TABLE vehicle_field_settings
  ADD COLUMN IF NOT EXISTS pbt_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cmt_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eixos_optional boolean NOT NULL DEFAULT false;
