-- ============================================================
-- Migration: Vincular Motorista ao Usuário do Sistema
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================
--
-- Contexto: Todo motorista cadastrado é automaticamente um usuário do sistema.
-- Esta migration adiciona o campo profile_id à tabela drivers, permitindo
-- identificar qual perfil de usuário corresponde a cada motorista.
-- Isso é necessário para que o sistema de checklists consiga localizar o
-- veículo associado ao motorista logado.
--

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON public.drivers(profile_id);
