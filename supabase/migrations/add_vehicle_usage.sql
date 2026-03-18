-- Adiciona campo de finalidade do veículo em vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_usage TEXT
  CHECK (vehicle_usage IN ('Operação', 'Uso Administrativo', 'Uso por Lideranças', 'Outros'));

-- Adiciona coluna de configuração opcional em vehicle_field_settings
ALTER TABLE public.vehicle_field_settings
  ADD COLUMN IF NOT EXISTS vehicle_usage_optional BOOLEAN NOT NULL DEFAULT false;
