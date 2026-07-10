-- ============================================================
-- MIGRATION: payment_installments_budget_cap_and_edit_lock
-- Data: 2026-07-09
-- Descrição:
--   (A) Trava de orçamento: SUM(value) das parcelas NÃO reprovadas
--       da mesma OS + valor novo não pode exceder approved_cost.
--   (B) Edição de campos (sem mudança de status) só é permitida
--       enquanto a parcela está 'pendente_aprovacao'.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ---------- (A) Trava de orçamento ----------
CREATE OR REPLACE FUNCTION public.fn_enforce_payment_installment_budget_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget   NUMERIC(12,2);
  v_existing NUMERIC(12,2);
BEGIN
  -- Só valida quando cria parcela ou quando o valor muda numa edição.
  IF TG_OP = 'UPDATE' AND NEW.value = OLD.value THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(approved_cost, 0)
    INTO v_budget
    FROM public.maintenance_orders
    WHERE id = NEW.maintenance_order_id;

  -- Soma das parcelas NÃO reprovadas da mesma OS, excluindo a própria linha.
  -- Em INSERT, NEW.id já vem preenchido pelo DEFAULT gen_random_uuid();
  -- em lote, cada linha já inserida na mesma instrução é visível aqui,
  -- então a soma cresce corretamente linha a linha.
  SELECT COALESCE(SUM(value), 0)
    INTO v_existing
    FROM public.payment_installments
    WHERE maintenance_order_id = NEW.maintenance_order_id
      AND status <> 'reprovado'
      AND id <> NEW.id;

  IF (v_existing + NEW.value) > v_budget THEN
    RAISE EXCEPTION
      'Valor excede o orçamento aprovado (%). Saldo disponível: %.',
      v_budget, (v_budget - v_existing);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payment_installment_budget_cap
  ON public.payment_installments;
CREATE TRIGGER trg_enforce_payment_installment_budget_cap
  BEFORE INSERT OR UPDATE OF value ON public.payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_payment_installment_budget_cap();

-- ---------- (B) Edição só quando pendente ----------
-- Recria a função de transição preservando aprovar/reprovar/pagar e
-- adicionando a trava: edição de campos (status inalterado) só se pendente.
CREATE OR REPLACE FUNCTION public.fn_validate_payment_installment_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  my_rank INT;
BEGIN
  NEW.updated_at := NOW();

  -- Sem mudança de status: edição de campos SÓ é permitida se pendente.
  IF NEW.status = OLD.status THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION
        'Edição não permitida: só é possível editar parcelas pendentes de aprovação.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();
  my_rank := public.role_rank(my_role);

  IF NEW.status IN ('aprovado', 'reprovado') THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível aprovar/reprovar uma parcela pendente de aprovação.';
    END IF;
    IF NOT (my_role = 'Admin Master' OR my_rank >= public.role_rank('Coordinator')) THEN
      RAISE EXCEPTION 'Permissão negada: apenas Coordenador ou superior pode aprovar/reprovar parcelas.';
    END IF;
    NEW.payment_approved_by := auth.uid();
    NEW.payment_approved_at := NOW();
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    IF OLD.status <> 'aprovado' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível marcar como Pago uma parcela já aprovada.';
    END IF;
    IF NOT (my_role = 'Financeiro' OR my_role = 'Admin Master' OR my_rank >= 3) THEN
      RAISE EXCEPTION 'Permissão negada: cargo sem permissão para marcar parcela como paga.';
    END IF;
    NEW.paid_by := auth.uid();
    NEW.paid_at := NOW();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

NOTIFY pgrst, 'reload schema';
