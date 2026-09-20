-- ============================================================
-- ROLLBACK de 20260919000000_maintenance_cancellation_reason
-- ⚠️ A COLUNA NÃO É REMOVIDA. Dado gravado permanece.
--    Remoção manual, se realmente necessária, na última linha (comentada).
-- ============================================================

DROP TRIGGER IF EXISTS trg_enforce_maintenance_cancellation_reason ON public.maintenance_orders;
DROP FUNCTION IF EXISTS public.fn_enforce_maintenance_cancellation_reason();

-- Restaura enforce_workshop_maintenance_columns SEM a linha de cancellation_reason.
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

-- ALTER TABLE public.maintenance_orders DROP COLUMN cancellation_reason;
