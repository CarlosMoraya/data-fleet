-- ============================================================
-- MIGRATION: enforce_workshop_maintenance_columns
-- Data: 2026-06-25
-- Descrição: Impede que o role Workshop altere colunas de
--            identidade/financeiro/aprovação via requisição forjada.
--            Permite apenas mudar status para 'Aguardando aprovação'
--            e budget_status para 'pendente'.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

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

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'Aguardando aprovação' THEN
    RAISE EXCEPTION 'Workshop so pode mudar o status para Aguardando aprovacao';
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
