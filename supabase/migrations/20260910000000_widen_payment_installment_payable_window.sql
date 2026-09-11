-- ============================================================
-- MIGRATION: widen_payment_installment_payable_window
-- Data: 2026-09-10
-- Descrição: amplia a janela em que uma OS de manutenção pode receber
--            novas parcelas de pagamento. Antes: só 'Concluído' e
--            'Veículo retirado'. Agora: a partir de 'Orçamento aprovado'.
--            Motivação: as oficinas enviam nota fiscal e boleto assim que
--            o orçamento é aprovado. Continua exigindo budget_status =
--            'aprovado'. O teto de valor (fn_enforce_payment_installment_
--            budget_cap) e a máquina de estados (fn_validate_payment_
--            installment_transition) não são tocados.
--            Nenhuma RLS, coluna, constraint, gatilho ou dado é alterado.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

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

  -- Janela pagavel: da aprovacao do orcamento ate a retirada do veiculo.
  IF NOT FOUND
     OR source_budget_status IS DISTINCT FROM 'aprovado'
     OR source_status IS NULL
     OR source_status NOT IN (
       'Orçamento aprovado',
       'Serviço em execução',
       'Concluído',
       'Veículo retirado'
     )
  THEN
    RAISE EXCEPTION 'Pagamento de manutencao exige orcamento aprovado e OS entre Orcamento aprovado e Veiculo retirado';
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Reload do schema PostgREST ───────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── Conferência pós-aplicação ────────────────────────────────
-- Rodar supabase/diagnostics/check-payment-installment-payable-window.sql
-- no mesmo banco. Esperado: todas as colunas booleanas conforme o arquivo.

-- ─── Rollback exato — inteiramente comentado ──────────────────
-- Restaura a versão de 20260827000000_enforce_maintenance_status_budget_coherence.sql:
--
-- CREATE OR REPLACE FUNCTION public.fn_enforce_payment_installment_source_payable()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $rollback$
-- DECLARE
--   source_status TEXT;
--   source_budget_status TEXT;
-- BEGIN
--   IF auth.uid() IS NULL THEN
--     RETURN NEW;
--   END IF;
--
--   IF NEW.source_type IS DISTINCT FROM 'maintenance_order' THEN
--     RETURN NEW;
--   END IF;
--
--   SELECT status, budget_status
--     INTO source_status, source_budget_status
--     FROM public.maintenance_orders
--    WHERE id = NEW.maintenance_order_id;
--
--   IF NOT FOUND
--      OR source_budget_status IS DISTINCT FROM 'aprovado'
--      OR (
--        source_status IS DISTINCT FROM 'Concluído'
--        AND source_status IS DISTINCT FROM 'Veículo retirado'
--      )
--   THEN
--     RAISE EXCEPTION 'Pagamento de manutencao exige orcamento aprovado e OS concluida ou retirada';
--   END IF;
--
--   RETURN NEW;
-- END;
-- $rollback$;
--
-- NOTIFY pgrst, 'reload schema';
