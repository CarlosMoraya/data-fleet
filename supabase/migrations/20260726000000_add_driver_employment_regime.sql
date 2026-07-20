-- ============================================================
-- MIGRATION: add_driver_employment_regime
-- Data: 2026-07-20
-- Descrição: Adiciona o regime de contratação do motorista (CLT/PJ)
--            e a URL do contrato de prestação de serviços (apenas PJ).
--            Aditiva e não-destrutiva: ambas as colunas são NULL-áveis
--            e nenhuma linha existente é alterada.
-- ============================================================

-- 1. Regime de contratação (NULL = não informado, para os cadastros legados)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS employment_regime TEXT;

-- 2. URL pública do contrato de prestação de serviços (somente para PJ)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS service_contract_upload TEXT;

-- 3. Constraint: só aceita CLT, PJ ou NULL
ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_employment_regime_check;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_employment_regime_check
  CHECK (employment_regime IS NULL OR employment_regime IN ('CLT', 'PJ'));

-- 4. Índice parcial para a consulta de conformidade de contratos PJ do Dashboard
CREATE INDEX IF NOT EXISTS idx_drivers_pj_regime
  ON public.drivers (client_id)
  WHERE employment_regime = 'PJ';

-- ============================================================
-- VALIDAÇÃO (executar após aplicar)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'drivers'
--    AND column_name IN ('employment_regime', 'service_contract_upload');
--
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.drivers'::regclass
--    AND conname = 'drivers_employment_regime_check';
--
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public' AND tablename = 'drivers'
--    AND indexname = 'idx_drivers_pj_regime';
--
-- SELECT COUNT(*) AS total, COUNT(employment_regime) AS com_regime
--   FROM public.drivers;
--   -- esperado: com_regime = 0 logo após a migration
