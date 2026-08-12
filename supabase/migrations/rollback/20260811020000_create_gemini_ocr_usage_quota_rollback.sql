-- ============================================================
-- ROLLBACK de 20260811020000_create_gemini_ocr_usage_quota.sql
-- Data: 2026-08-11
--
-- ⚠️ Remover a cota reabre o consumo ilimitado do Gemini por
--    usuário. Aplicar apenas se a RPC causar falha sistêmica, e
--    em PROD somente com autorização expressa.
--
-- NÃO remove documentos, resultados de OCR ou dados de negócio:
-- a tabela abaixo guarda apenas contadores de consumo.
--
-- A validação de tamanho, tipo, assinatura e prompt na Edge
-- Function NÃO faz parte deste rollback e deve permanecer ativa.
-- ============================================================

DROP FUNCTION IF EXISTS public.consume_gemini_ocr_quota(bigint);

DROP TABLE IF EXISTS public.gemini_ocr_usage_windows;
