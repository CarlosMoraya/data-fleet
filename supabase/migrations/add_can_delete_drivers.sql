-- ============================================================
-- MIGRATION: add_can_delete_drivers
-- Data: 2026-03-11
-- Descrição: Adiciona coluna can_delete_drivers na tabela profiles.
--            Separa a permissão de exclusão de motoristas da permissão
--            de exclusão de veículos (que já existia como can_delete_vehicles).
-- ============================================================
-- INSTRUÇÕES: Execute este script no Supabase Dashboard → SQL Editor
-- ============================================================

-- PASSO 1: Adicionar coluna can_delete_drivers com default false
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_delete_drivers BOOLEAN NOT NULL DEFAULT false;

-- PASSO 2: (Opcional) Copiar valor de can_delete_vehicles para can_delete_drivers
-- nos usuários que já tinham permissão de deletar veículos.
-- Descomente a linha abaixo se quiser migrar automaticamente:
UPDATE public.profiles SET can_delete_drivers = can_delete_vehicles WHERE can_delete_vehicles = true;

-- VERIFICAÇÃO: rodar após executar para confirmar
-- SELECT id, name, role, can_delete_vehicles, can_delete_drivers FROM public.profiles LIMIT 10;
