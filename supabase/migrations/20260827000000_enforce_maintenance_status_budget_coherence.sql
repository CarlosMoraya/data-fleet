-- ============================================================
-- MIGRATION: enforce_maintenance_status_budget_coherence
-- Data: 2026-08-27
-- Descrição: impede divergência entre status operacional e status de orçamento
--            das OS e recusa novos pagamentos de manutenção fora da regra de
--            elegibilidade financeira.
--            (A) Adiciona a trava de coerência de status.
--            (B) Fecha a brecha da função da oficina que permitia voltar para
--                "Aguardando aprovação" com orçamento já aprovado.
--            (C) Adiciona guard de INSERT em payment_installments.
--            Nenhuma RLS, coluna, constraint ou gatilho existente de itens/
--            auditoria é recriado ou desabilitado.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Só executar depois do reparo de dados do Passo 5 no banco alvo.
-- ============================================================

-- ─── (A) Coerência entre status operacional e orçamento ──────

CREATE OR REPLACE FUNCTION public.fn_enforce_maintenance_status_budget_coherence()
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

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('Serviço em execução', 'Concluído', 'Veículo retirado')
     AND NEW.budget_status IN ('pendente', 'reaberto')
  THEN
    RAISE EXCEPTION 'Orcamento aguardando decisao: a OS nao pode avancar para %', NEW.status;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'Aguardando aprovação'
     AND OLD.budget_status = 'aprovado'
     AND NEW.budget_status = 'aprovado'
  THEN
    RAISE EXCEPTION 'Orcamento ja aprovado: a OS nao volta para Aguardando aprovacao';
  END IF;

  -- Qualquer transição para Cancelado é permitida; sem_orcamento e reprovado
  -- também nunca bloqueiam uma transição operacional.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_maintenance_status_budget_coherence ON public.maintenance_orders;
CREATE TRIGGER trg_enforce_maintenance_status_budget_coherence
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_maintenance_status_budget_coherence();

-- ─── (B) Ajuste cirúrgico da trava específica da oficina ─────

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

-- ─── (C) Guard de novos pagamentos de manutenção ─────────────

CREATE OR REPLACE FUNCTION public.fn_enforce_payment_installment_source_payable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_status TEXT;
  source_budget_status TEXT;
BEGIN
  -- Sem usuário autenticado (SQL Editor / service_role): reparo manual liberado.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type IS DISTINCT FROM 'maintenance_order' THEN
    RETURN NEW;
  END IF;

  SELECT status, budget_status
    INTO source_status, source_budget_status
    FROM public.maintenance_orders
   WHERE id = NEW.maintenance_order_id;

  IF NOT FOUND
     OR source_budget_status IS DISTINCT FROM 'aprovado'
     OR (
       source_status IS DISTINCT FROM 'Concluído'
       AND source_status IS DISTINCT FROM 'Veículo retirado'
     )
  THEN
    RAISE EXCEPTION 'Pagamento de manutencao exige orcamento aprovado e OS concluida ou retirada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payment_installment_source_payable ON public.payment_installments;
CREATE TRIGGER trg_enforce_payment_installment_source_payable
  BEFORE INSERT ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_payment_installment_source_payable();

-- ─── (D) Reload do schema PostgREST ───────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── Conferência pós-aplicação ────────────────────────────────
-- SELECT tgname, tgrelid::regclass AS tabela, tgenabled
--   FROM pg_trigger
--  WHERE tgname IN (
--    'trg_enforce_maintenance_status_budget_coherence',
--    'trg_enforce_payment_installment_source_payable',
--    'trg_enforce_workshop_maintenance_columns',
--    'trg_lock_approved_budget_order_columns',
--    'trg_lock_approved_budget_items'
--  )
--  ORDER BY tabela, tgname;
-- Esperado: os gatilhos novos e os existentes listados com tgenabled = 'O'.

-- ─── Rollback exato — inteiramente comentado ──────────────────
-- DROP TRIGGER IF EXISTS trg_enforce_payment_installment_source_payable ON public.payment_installments;
-- DROP FUNCTION IF EXISTS public.fn_enforce_payment_installment_source_payable();
--
-- DROP TRIGGER IF EXISTS trg_enforce_maintenance_status_budget_coherence ON public.maintenance_orders;
-- DROP FUNCTION IF EXISTS public.fn_enforce_maintenance_status_budget_coherence();
--
-- -- Restaura enforce_workshop_maintenance_columns na versão de
-- -- 20260821000000_lock_approved_budget_for_workshop.sql:
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
--   IF OLD.budget_status = 'aprovado' AND (
--        NEW.budget_pdf_url  IS DISTINCT FROM OLD.budget_pdf_url
--     OR NEW.budget_discount IS DISTINCT FROM OLD.budget_discount
--     OR NEW.estimated_cost  IS DISTINCT FROM OLD.estimated_cost
--     OR NEW.budget_status   IS DISTINCT FROM OLD.budget_status
--   ) THEN
--     RAISE EXCEPTION 'Orcamento aprovado: a oficina nao pode alterar orcamento, desconto ou PDF';
--   END IF;
--
--   IF NEW.status IS DISTINCT FROM OLD.status
--      AND NOT (
--        NEW.status = 'Aguardando aprovação'
--        OR (NEW.status = 'Serviço em execução'
--            AND OLD.status = 'Orçamento aprovado'
--            AND OLD.budget_status = 'aprovado')
--      )
--   THEN
--     RAISE EXCEPTION 'Workshop so pode enviar para aprovacao ou iniciar servico de orcamento aprovado';
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
