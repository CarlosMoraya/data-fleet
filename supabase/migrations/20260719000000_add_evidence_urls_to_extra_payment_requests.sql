-- ============================================================
-- MIGRATION: add_evidence_urls_to_extra_payment_requests
-- Data: 2026-07-19
-- Descrição: Fotos de evidência do serviço realizado (até 3)
--            no cabeçalho do Pagamento Extra. Caminhos do bucket
--            PRIVADO financial-documents — nunca URL pública.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Tabela COM DADOS EM PRODUÇÃO. Coluna anulável, sem default
--    obrigatório: registros existentes permanecem válidos.
-- ============================================================

ALTER TABLE public.extra_payment_requests
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[];

ALTER TABLE public.extra_payment_requests
  DROP CONSTRAINT IF EXISTS extra_payment_requests_evidence_urls_max;

ALTER TABLE public.extra_payment_requests
  ADD CONSTRAINT extra_payment_requests_evidence_urls_max
  CHECK (evidence_urls IS NULL OR array_length(evidence_urls, 1) <= 3);
