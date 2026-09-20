-- ============================================================
-- MIGRATION: maintenance_cancellation_reason
-- Data: 2026-09-19
-- Descrição: Motivo obrigatório no cancelamento de Ordem de Serviço.
--            1) coluna aditiva `cancellation_reason` (nullable, sem backfill)
--            2) gatilho que exige o motivo na transição para 'Cancelado'
--               e carimba autor/data a partir de auth.uid()
--            3) `cancellation_reason` entra na lista de colunas protegidas
--               contra o papel Workshop
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ─── 1. Coluna ────────────────────────────────────────────────

ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN public.maintenance_orders.cancellation_reason IS
  'Motivo informado no cancelamento da OS. NULL nas OS canceladas antes de 2026-09-19 (22 linhas em PROD); a interface exibe "Nao informado" nesses casos.';

-- ─── 2. Gatilho de motivo obrigatorio ─────────────────────────

CREATE OR REPLACE FUNCTION public.fn_enforce_maintenance_cancellation_reason()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Sem usuario autenticado (SQL Editor / service_role): reparo manual liberado.
  -- Mesmo escape hatch de fn_lock_approved_budget_order_columns.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'Cancelado' AND OLD.status IS DISTINCT FROM 'Cancelado' THEN
    normalized := btrim(COALESCE(NEW.cancellation_reason, ''));

    IF normalized = '' THEN
      RAISE EXCEPTION 'Motivo do cancelamento e obrigatorio';
    END IF;

    IF char_length(normalized) > 500 THEN
      RAISE EXCEPTION 'Motivo do cancelamento excede 500 caracteres';
    END IF;

    NEW.cancellation_reason := normalized;
    NEW.cancelled_by_id     := auth.uid();
    NEW.cancelled_at        := now();

    RETURN NEW;
  END IF;

  -- Fora da transicao para 'Cancelado', o motivo e imutavel.
  IF NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
    RAISE EXCEPTION 'Motivo do cancelamento so pode ser gravado no cancelamento da OS';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_maintenance_cancellation_reason ON public.maintenance_orders;
CREATE TRIGGER trg_enforce_maintenance_cancellation_reason
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_maintenance_cancellation_reason();

-- ─── 3. Workshop nao altera o motivo ──────────────────────────
-- Corpo vigente de 2026-08-27 reproduzido integralmente, com UMA linha
-- acrescentada na lista de colunas protegidas: cancellation_reason.

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
     OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
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
       (NEW.status = 'Aguardando aprovação' AND OLD.budget_status <> 'aprovado')
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
