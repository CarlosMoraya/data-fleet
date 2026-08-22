-- ============================================================
-- MIGRATION: lock_approved_budget_for_workshop
-- Data: 2026-08-21
-- Descrição: torna o orçamento aprovado imutável para o role Workshop.
--            (A) Substitui enforce_workshop_maintenance_columns preservando
--                todas as proteções atuais e acrescentando o congelamento de
--                orçamento/desconto/PDF quando budget_status = 'aprovado',
--                além de liberar a transição "Orçamento aprovado" →
--                "Serviço em execução" feita pela própria oficina.
--            (B) Cria fn_lock_approved_budget_items, que recusa qualquer
--                INSERT/UPDATE/DELETE de itens de uma OS já aprovada quando o
--                autor é Workshop.
--            Nenhuma policy RLS, coluna ou dado existente é alterado.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ─── (A) Gatilho de colunas protegidas da OS ──────────────────

CREATE OR REPLACE FUNCTION public.enforce_workshop_maintenance_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  editor_role TEXT;
BEGIN
  SELECT role INTO editor_role FROM public.profiles WHERE id = auth.uid();

  IF editor_role IS DISTINCT FROM 'Workshop' THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id        IS DISTINCT FROM OLD.client_id
     OR NEW.vehicle_id     IS DISTINCT FROM OLD.vehicle_id
     OR NEW.workshop_id    IS DISTINCT FROM OLD.workshop_id
     OR NEW.os_number      IS DISTINCT FROM OLD.os_number
     OR NEW.created_by_id  IS DISTINCT FROM OLD.created_by_id
     OR NEW.approved_cost  IS DISTINCT FROM OLD.approved_cost
     OR NEW.budget_reviewed_by IS DISTINCT FROM OLD.budget_reviewed_by
     OR NEW.budget_reviewed_at IS DISTINCT FROM OLD.budget_reviewed_at
     OR NEW.cancelled_at   IS DISTINCT FROM OLD.cancelled_at
     OR NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
  THEN
    RAISE EXCEPTION 'Workshop nao pode alterar campos protegidos da OS';
  END IF;

  -- Orçamento aprovado é imutável para a oficina: PDF, descontos, valor
  -- estimado e o próprio budget_status ficam congelados.
  -- Esta verificação vem ANTES das regras de status/budget_status abaixo.
  IF OLD.budget_status = 'aprovado' AND (
       NEW.budget_pdf_url  IS DISTINCT FROM OLD.budget_pdf_url
    OR NEW.budget_discount IS DISTINCT FROM OLD.budget_discount
    OR NEW.estimated_cost  IS DISTINCT FROM OLD.estimated_cost
    OR NEW.budget_status   IS DISTINCT FROM OLD.budget_status
  ) THEN
    RAISE EXCEPTION 'Orcamento aprovado: a oficina nao pode alterar orcamento, desconto ou PDF';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       NEW.status = 'Aguardando aprovação'
       OR (NEW.status = 'Serviço em execução'
           AND OLD.status = 'Orçamento aprovado'
           AND OLD.budget_status = 'aprovado')
     )
  THEN
    RAISE EXCEPTION 'Workshop so pode enviar para aprovacao ou iniciar servico de orcamento aprovado';
  END IF;

  IF NEW.budget_status IS DISTINCT FROM OLD.budget_status AND NEW.budget_status <> 'pendente' THEN
    RAISE EXCEPTION 'Workshop nao pode aprovar/reprovar orcamento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_workshop_maintenance_columns ON public.maintenance_orders;
CREATE TRIGGER trg_enforce_workshop_maintenance_columns
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_maintenance_columns();

-- ─── (B) Gatilho de itens do orçamento aprovado ───────────────

CREATE OR REPLACE FUNCTION public.fn_lock_approved_budget_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  editor_role TEXT;
  target_order UUID;
  order_budget_status TEXT;
BEGIN
  SELECT role INTO editor_role FROM public.profiles WHERE id = auth.uid();
  IF editor_role IS DISTINCT FROM 'Workshop' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_order := COALESCE(NEW.maintenance_order_id, OLD.maintenance_order_id);

  SELECT budget_status INTO order_budget_status
    FROM public.maintenance_orders WHERE id = target_order;

  IF order_budget_status = 'aprovado' THEN
    RAISE EXCEPTION 'Orcamento aprovado: os itens nao podem mais ser alterados pela oficina';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_approved_budget_items ON public.maintenance_budget_items;
CREATE TRIGGER trg_lock_approved_budget_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_approved_budget_items();

-- ─── (C) Reload do schema PostgREST ───────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── Conferência pós-aplicação ────────────────────────────────
-- SELECT tgname, tgrelid::regclass AS tabela, tgenabled
--   FROM pg_trigger
--  WHERE tgname IN ('trg_enforce_workshop_maintenance_columns', 'trg_lock_approved_budget_items');
-- Esperado: 2 linhas, tgenabled = 'O', nas tabelas maintenance_orders e maintenance_budget_items.

-- ─── Rollback exato ───────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_lock_approved_budget_items ON public.maintenance_budget_items;
-- DROP FUNCTION IF EXISTS public.fn_lock_approved_budget_items();
--
-- -- Restaura enforce_workshop_maintenance_columns na versão de
-- -- 20260625000200_enforce_workshop_maintenance_columns.sql:
-- CREATE OR REPLACE FUNCTION public.enforce_workshop_maintenance_columns()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $rollback$
-- DECLARE
--   editor_role TEXT;
-- BEGIN
--   SELECT role INTO editor_role FROM public.profiles WHERE id = auth.uid();
--
--   IF editor_role IS DISTINCT FROM 'Workshop' THEN
--     RETURN NEW;
--   END IF;
--
--   IF NEW.client_id        IS DISTINCT FROM OLD.client_id
--      OR NEW.vehicle_id     IS DISTINCT FROM OLD.vehicle_id
--      OR NEW.workshop_id    IS DISTINCT FROM OLD.workshop_id
--      OR NEW.os_number      IS DISTINCT FROM OLD.os_number
--      OR NEW.created_by_id  IS DISTINCT FROM OLD.created_by_id
--      OR NEW.approved_cost  IS DISTINCT FROM OLD.approved_cost
--      OR NEW.budget_reviewed_by IS DISTINCT FROM OLD.budget_reviewed_by
--      OR NEW.budget_reviewed_at IS DISTINCT FROM OLD.budget_reviewed_at
--      OR NEW.cancelled_at   IS DISTINCT FROM OLD.cancelled_at
--      OR NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
--   THEN
--     RAISE EXCEPTION 'Workshop nao pode alterar campos protegidos da OS';
--   END IF;
--
--   IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'Aguardando aprovação' THEN
--     RAISE EXCEPTION 'Workshop so pode mudar o status para Aguardando aprovacao';
--   END IF;
--
--   IF NEW.budget_status IS DISTINCT FROM OLD.budget_status AND NEW.budget_status <> 'pendente' THEN
--     RAISE EXCEPTION 'Workshop nao pode aprovar/reprovar orcamento';
--   END IF;
--
--   RETURN NEW;
-- END;
-- $rollback$;
--
-- DROP TRIGGER IF EXISTS trg_enforce_workshop_maintenance_columns ON public.maintenance_orders;
-- CREATE TRIGGER trg_enforce_workshop_maintenance_columns
--   BEFORE UPDATE ON public.maintenance_orders
--   FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_maintenance_columns();
--
-- NOTIFY pgrst, 'reload schema';
