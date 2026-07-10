-- ============================================================
-- MIGRATION: add_nota_fiscal_url_2
-- Data: 2026-07-09
-- Descrição: 2º documento de nota fiscal (opcional) na parcela.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================
ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS nota_fiscal_url_2 TEXT;

NOTIFY pgrst, 'reload schema';
