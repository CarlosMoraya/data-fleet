-- ============================================================
-- MIGRATION: allow_null_client_id_profiles
-- Descrição: Permite client_id NULL em profiles para accounts
--            do tipo Workshop e Admin Master, que são globais
--            e não pertencem a um tenant específico.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ALTER COLUMN client_id DROP NOT NULL;
