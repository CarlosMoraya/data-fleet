-- ============================================================
-- MIGRATION: lock_approved_budget_for_all_roles
-- Data: 2026-08-22
-- Descrição: estende a trava de orçamento aprovado a TODOS os papéis.
--            A migration 20260821000000 congelou o orçamento aprovado apenas
--            para o papel Workshop; Fleet Assistant+ continuava conseguindo
--            alterar itens, desconto e PDF pelo formulário completo, fazendo a
--            lista de itens divergir de approved_cost (caso real: OS-2606-8910,
--            itens R$ 5.350,00 contra R$ 350,00 aprovados).
--            (A) fn_lock_approved_budget_items passa a recusar INSERT/UPDATE/
--                DELETE de itens de OS aprovada para qualquer papel autenticado.
--            (B) fn_lock_approved_budget_order_columns (novo) recusa alteração
--                de budget_pdf_url, budget_discount, estimated_cost,
--                approved_cost e budget_status de OS aprovada, para qualquer
--                papel autenticado — inclusive Admin Master.
--            O gatilho trg_enforce_workshop_maintenance_columns permanece como
--            está: ele guarda as regras adicionais específicas da oficina.
--
-- ESCAPE HATCH DELIBERADO: quando auth.uid() é NULL — SQL Editor do Supabase e
-- service_role — os dois gatilhos liberam a escrita. É o único caminho de
-- reparo de dados (ver supabase/diagnostics/check-approved-budget-integrity.sql)
-- e não é alcançável pela aplicação, que sempre atua com JWT de usuário.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ─── (A) Itens do orçamento: imutáveis para todos ─────────────

CREATE OR REPLACE FUNCTION public.fn_lock_approved_budget_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order UUID;
  order_budget_status TEXT;
BEGIN
  -- Sem usuário autenticado (SQL Editor / service_role): reparo manual liberado.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_order := COALESCE(NEW.maintenance_order_id, OLD.maintenance_order_id);

  SELECT budget_status INTO order_budget_status
    FROM public.maintenance_orders WHERE id = target_order;

  IF order_budget_status = 'aprovado' THEN
    RAISE EXCEPTION 'Orcamento aprovado: os itens nao podem mais ser alterados';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_approved_budget_items ON public.maintenance_budget_items;
CREATE TRIGGER trg_lock_approved_budget_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_approved_budget_items();

-- ─── (B) Colunas de orçamento da OS: imutáveis para todos ─────

CREATE OR REPLACE FUNCTION public.fn_lock_approved_budget_order_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem usuário autenticado (SQL Editor / service_role): reparo manual liberado.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.budget_status = 'aprovado' AND (
       NEW.budget_pdf_url  IS DISTINCT FROM OLD.budget_pdf_url
    OR NEW.budget_discount IS DISTINCT FROM OLD.budget_discount
    OR NEW.estimated_cost  IS DISTINCT FROM OLD.estimated_cost
    OR NEW.approved_cost   IS DISTINCT FROM OLD.approved_cost
    OR NEW.budget_status   IS DISTINCT FROM OLD.budget_status
  ) THEN
    RAISE EXCEPTION 'Orcamento aprovado: orcamento, desconto, custos e PDF nao podem mais ser alterados';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_approved_budget_order_columns ON public.maintenance_orders;
CREATE TRIGGER trg_lock_approved_budget_order_columns
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_approved_budget_order_columns();

-- ─── (C) Reload do schema PostgREST ───────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── Conferência pós-aplicação ────────────────────────────────
-- SELECT tgname, tgrelid::regclass AS tabela, tgenabled
--   FROM pg_trigger
--  WHERE tgname IN (
--    'trg_enforce_workshop_maintenance_columns',
--    'trg_lock_approved_budget_items',
--    'trg_lock_approved_budget_order_columns'
--  );
-- Esperado: 3 linhas, tgenabled = 'O'.

-- ─── Rollback exato ───────────────────────────────────────────
-- Volta ao estado da migration 20260821000000 (trava só para o papel Workshop):
--
-- DROP TRIGGER IF EXISTS trg_lock_approved_budget_order_columns ON public.maintenance_orders;
-- DROP FUNCTION IF EXISTS public.fn_lock_approved_budget_order_columns();
--
-- CREATE OR REPLACE FUNCTION public.fn_lock_approved_budget_items()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $rollback$
-- DECLARE
--   editor_role TEXT;
--   target_order UUID;
--   order_budget_status TEXT;
-- BEGIN
--   SELECT role INTO editor_role FROM public.profiles WHERE id = auth.uid();
--   IF editor_role IS DISTINCT FROM 'Workshop' THEN
--     RETURN COALESCE(NEW, OLD);
--   END IF;
--
--   target_order := COALESCE(NEW.maintenance_order_id, OLD.maintenance_order_id);
--
--   SELECT budget_status INTO order_budget_status
--     FROM public.maintenance_orders WHERE id = target_order;
--
--   IF order_budget_status = 'aprovado' THEN
--     RAISE EXCEPTION 'Orcamento aprovado: os itens nao podem mais ser alterados pela oficina';
--   END IF;
--
--   RETURN COALESCE(NEW, OLD);
-- END;
-- $rollback$;
--
-- NOTIFY pgrst, 'reload schema';
