-- Migration: add_budget_discounts
-- Data: 2026-08-03
-- Descrição: adiciona desconto em reais (R$) ao orçamento de manutenção — por item ou geral,
-- mutuamente exclusivos — com limites e exclusividade impostos por CHECK e TRIGGER.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)

-- ─── 1. Coluna de desconto por item ───────────────────────────

ALTER TABLE public.maintenance_budget_items
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.maintenance_budget_items
  DROP CONSTRAINT IF EXISTS maintenance_budget_items_discount_non_negative;
ALTER TABLE public.maintenance_budget_items
  ADD CONSTRAINT maintenance_budget_items_discount_non_negative CHECK (discount >= 0);

ALTER TABLE public.maintenance_budget_items
  DROP CONSTRAINT IF EXISTS maintenance_budget_items_discount_within_line;
ALTER TABLE public.maintenance_budget_items
  ADD CONSTRAINT maintenance_budget_items_discount_within_line CHECK (discount <= quantity * value);

-- ─── 2. Coluna de desconto geral (OS) ─────────────────────────

ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS budget_discount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_budget_discount_non_negative;
ALTER TABLE public.maintenance_orders
  ADD CONSTRAINT maintenance_orders_budget_discount_non_negative CHECK (budget_discount >= 0);

-- ─── 3. Exclusividade: item não pode ter desconto se a OS já tem desconto geral ───

CREATE OR REPLACE FUNCTION public.fn_enforce_budget_discount_exclusivity_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discount > 0 AND (
    SELECT COALESCE(budget_discount, 0) > 0
    FROM public.maintenance_orders
    WHERE id = NEW.maintenance_order_id
  ) THEN
    RAISE EXCEPTION 'Desconto inválido: esta OS já possui desconto geral. Use desconto por item OU desconto geral, nunca os dois.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_budget_discount_exclusivity_item ON public.maintenance_budget_items;
CREATE TRIGGER trg_enforce_budget_discount_exclusivity_item
  BEFORE INSERT OR UPDATE OF discount ON public.maintenance_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_budget_discount_exclusivity_item();

-- ─── 4. Exclusividade: OS não pode ter desconto geral se algum item já tem desconto ───

CREATE OR REPLACE FUNCTION public.fn_enforce_budget_discount_exclusivity_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.budget_discount > 0 AND EXISTS (
    SELECT 1 FROM public.maintenance_budget_items
    WHERE maintenance_order_id = NEW.id AND discount > 0
  ) THEN
    RAISE EXCEPTION 'Desconto inválido: esta OS já possui desconto em itens. Use desconto por item OU desconto geral, nunca os dois.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_budget_discount_exclusivity_order ON public.maintenance_orders;
CREATE TRIGGER trg_enforce_budget_discount_exclusivity_order
  BEFORE INSERT OR UPDATE OF budget_discount ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_budget_discount_exclusivity_order();

-- ─── 5. Reload do schema PostgREST ─────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── Rollback exato ────────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_enforce_budget_discount_exclusivity_order ON public.maintenance_orders;
-- DROP FUNCTION IF EXISTS public.fn_enforce_budget_discount_exclusivity_order();
-- DROP TRIGGER IF EXISTS trg_enforce_budget_discount_exclusivity_item ON public.maintenance_budget_items;
-- DROP FUNCTION IF EXISTS public.fn_enforce_budget_discount_exclusivity_item();
-- ALTER TABLE public.maintenance_orders DROP COLUMN IF EXISTS budget_discount;
-- ALTER TABLE public.maintenance_budget_items DROP COLUMN IF EXISTS discount;
