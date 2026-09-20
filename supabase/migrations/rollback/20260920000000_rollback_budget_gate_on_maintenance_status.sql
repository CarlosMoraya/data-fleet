-- ============================================================
-- ROLLBACK: 20260920000000_enforce_budget_gate_on_maintenance_status
-- Data: 2026-09-20
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

DROP TRIGGER IF EXISTS trg_enforce_maintenance_budget_gate ON public.maintenance_orders;
DROP FUNCTION IF EXISTS public.fn_enforce_maintenance_budget_gate();

-- As colunas NÃO são removidas: podem já conter motivos reais de exceção.
-- Remoção só sob decisão explícita do usuário:
-- ALTER TABLE public.maintenance_orders
--   DROP CONSTRAINT IF EXISTS maintenance_orders_budget_override_by_id_fkey,
--   DROP COLUMN IF EXISTS budget_override_reason,
--   DROP COLUMN IF EXISTS budget_override_by_id,
--   DROP COLUMN IF EXISTS budget_override_at;

NOTIFY pgrst, 'reload schema';
