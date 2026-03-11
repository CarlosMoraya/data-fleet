-- ============================================================
-- MIGRATION: fix_vehicle_type_constraint
-- Data: 2026-03-11
-- Motivo: O frontend foi atualizado para usar tipos de veículo
--         em português, mas o banco ainda validava os valores
--         antigos em inglês (Light, Medium, Heavy).
-- ============================================================

-- PASSO 1: Migrar os dados existentes que usam os valores antigos
-- (Execute somente se você tiver dados com os valores antigos no banco)
UPDATE public.vehicles SET type = 'Passeio'   WHERE type = 'Light';
UPDATE public.vehicles SET type = 'Vuc'       WHERE type = 'Medium';
UPDATE public.vehicles SET type = 'Truck'     WHERE type = 'Heavy';
-- Nota: 'Cavalo' já está correto nos dois sistemas.

-- PASSO 2: Remover a constraint antiga
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;

-- PASSO 3: Adicionar a nova constraint com os valores em português
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_type_check
  CHECK (type IN ('Passeio', 'Utilitário', 'Van', 'Moto', 'Vuc', 'Toco', 'Truck', 'Cavalo'));

-- VERIFICAÇÃO: rodar esta query depois para confirmar que funciona
-- SELECT type, COUNT(*) FROM public.vehicles GROUP BY type;
