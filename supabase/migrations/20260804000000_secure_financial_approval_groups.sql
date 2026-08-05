-- ============================================================
-- MIGRATION: secure_financial_approval_groups
-- Data: 2026-08-04
-- Descrição: Reconciliação final (independente da ordem histórica
--   das migrations anteriores) dos triggers de payment_installments
--   e extra_payment_requests, e duas novas RPCs transacionais para
--   aprovação em lote:
--     - approve_maintenance_payment_group: aprova, numa única
--       transação, todas as parcelas pendentes de uma OS.
--     - approve_extra_payment_request_group: aprova o cabeçalho de
--       um pedido de Pagamento Extra e propaga para as parcelas.
--   Ambas SECURITY INVOKER (preservam RLS); allowlist exata de
--   papéis (Coordinator, Manager, Director, Admin Master); Fail
--   Closed em qualquer divergência de tenant/origem/ID/status/
--   versão (Optimistic Concurrency Control via updated_at).
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Rodar supabase/diagnostics/check-financial-approval-groups.sql
--    antes e depois de aplicar esta migration.
-- ============================================================

-- ============================================================
-- 1) RPC: approve_maintenance_payment_group
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_maintenance_payment_group(
  p_maintenance_order_id UUID,
  p_installment_ids UUID[],
  p_installment_updated_ats TIMESTAMPTZ[]
)
RETURNS TABLE (approved_count INTEGER, approved_ids UUID[])
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role TEXT;
  v_order_client_id UUID;
  v_snapshot_ids UUID[];
  v_expected_ids UUID[];
  v_mismatch_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão não autenticada.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('Coordinator', 'Manager', 'Director', 'Admin Master') THEN
    RAISE EXCEPTION 'Você não possui permissão para aprovar estas parcelas.';
  END IF;

  IF p_installment_ids IS NULL OR array_length(p_installment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma parcela pendente foi informada para aprovação.';
  END IF;
  IF p_installment_updated_ats IS NULL
     OR array_length(p_installment_ids, 1) <> array_length(p_installment_updated_ats, 1) THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;
  IF array_length(p_installment_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;
  IF (SELECT COUNT(DISTINCT x) FROM unnest(p_installment_ids) AS x) <> array_length(p_installment_ids, 1) THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;

  -- Trava a OS alvo; o tenant é derivado do agregado, nunca do browser.
  SELECT client_id INTO v_order_client_id
    FROM public.maintenance_orders
    WHERE id = p_maintenance_order_id
    FOR UPDATE;
  IF v_order_client_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;

  -- Trava o conjunto atual de parcelas pendentes da OS.
  -- FOR UPDATE não pode ser combinado com agregação na mesma consulta;
  -- a trava acontece na subconsulta antes de agregar os IDs bloqueados.
  SELECT array_agg(locked.id ORDER BY locked.id) INTO v_snapshot_ids
    FROM (
      SELECT id
        FROM public.payment_installments
        WHERE maintenance_order_id = p_maintenance_order_id
          AND source_type = 'maintenance_order'
          AND status = 'pendente_aprovacao'
        FOR UPDATE
    ) locked;

  SELECT array_agg(x ORDER BY x) INTO v_expected_ids FROM unnest(p_installment_ids) AS x;

  IF v_snapshot_ids IS DISTINCT FROM v_expected_ids THEN
    RAISE EXCEPTION 'As parcelas desta OS foram alteradas. Nada foi aprovado; revise os dados novamente.';
  END IF;

  -- Confere client_id, origem e updated_at (OCC) de cada parcela informada.
  SELECT COUNT(*) INTO v_mismatch_count
  FROM unnest(p_installment_ids, p_installment_updated_ats) WITH ORDINALITY AS snap(id, updated_at, ord)
  JOIN public.payment_installments pi ON pi.id = snap.id
  WHERE pi.maintenance_order_id IS DISTINCT FROM p_maintenance_order_id
     OR pi.source_type <> 'maintenance_order'
     OR pi.client_id IS DISTINCT FROM v_order_client_id
     OR pi.status <> 'pendente_aprovacao'
     OR pi.updated_at <> snap.updated_at;
  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'As parcelas desta OS foram alteradas. Nada foi aprovado; revise os dados novamente.';
  END IF;

  -- Aprova o conjunto inteiro num único UPDATE; o trigger de transição
  -- preenche payment_approved_by/payment_approved_at.
  UPDATE public.payment_installments
    SET status = 'aprovado'
    WHERE id = ANY(p_installment_ids)
      AND maintenance_order_id = p_maintenance_order_id
      AND source_type = 'maintenance_order'
      AND status = 'pendente_aprovacao';
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> array_length(p_installment_ids, 1) THEN
    RAISE EXCEPTION 'As parcelas desta OS foram alteradas. Nada foi aprovado; revise os dados novamente.';
  END IF;

  RETURN QUERY SELECT v_updated_count, p_installment_ids;
END;
$$;

-- ============================================================
-- 2) RPC: approve_extra_payment_request_group
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_extra_payment_request_group(
  p_extra_payment_request_id UUID,
  p_request_updated_at TIMESTAMPTZ,
  p_installment_ids UUID[],
  p_installment_updated_ats TIMESTAMPTZ[]
)
RETURNS TABLE (approved_count INTEGER, approved_installment_ids UUID[])
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role TEXT;
  v_request_client_id UUID;
  v_request_status TEXT;
  v_request_updated_at TIMESTAMPTZ;
  v_request_amount NUMERIC(12,2);
  v_snapshot_ids UUID[];
  v_expected_ids UUID[];
  v_mismatch_count INTEGER;
  v_installments_sum NUMERIC(12,2);
  v_updated_count INTEGER;
  v_still_pending INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão não autenticada.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('Coordinator', 'Manager', 'Director', 'Admin Master') THEN
    RAISE EXCEPTION 'Você não possui permissão para aprovar estas parcelas.';
  END IF;

  IF p_installment_ids IS NULL OR array_length(p_installment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Este pedido não possui parcelas e não pode ser aprovado.';
  END IF;
  IF p_installment_updated_ats IS NULL
     OR array_length(p_installment_ids, 1) <> array_length(p_installment_updated_ats, 1) THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;
  IF array_length(p_installment_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;
  IF (SELECT COUNT(DISTINCT x) FROM unnest(p_installment_ids) AS x) <> array_length(p_installment_ids, 1) THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;

  SELECT client_id, status, updated_at, amount
    INTO v_request_client_id, v_request_status, v_request_updated_at, v_request_amount
    FROM public.extra_payment_requests
    WHERE id = p_extra_payment_request_id
    FOR UPDATE;
  IF v_request_client_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível validar este grupo de pagamento.';
  END IF;
  IF v_request_status <> 'pendente_aprovacao' OR v_request_updated_at <> p_request_updated_at THEN
    RAISE EXCEPTION 'Este pedido foi alterado. Nada foi aprovado; revise novamente.';
  END IF;

  -- FOR UPDATE não pode ser combinado com agregação na mesma consulta;
  -- a trava acontece na subconsulta antes de agregar os IDs bloqueados.
  SELECT array_agg(locked.id ORDER BY locked.id) INTO v_snapshot_ids
    FROM (
      SELECT id
        FROM public.payment_installments
        WHERE extra_payment_request_id = p_extra_payment_request_id
          AND source_type = 'extra_payment'
          AND status = 'pendente_aprovacao'
        FOR UPDATE
    ) locked;

  SELECT array_agg(x ORDER BY x) INTO v_expected_ids FROM unnest(p_installment_ids) AS x;

  IF v_snapshot_ids IS DISTINCT FROM v_expected_ids THEN
    RAISE EXCEPTION 'Este pedido foi alterado. Nada foi aprovado; revise novamente.';
  END IF;

  SELECT COUNT(*) INTO v_mismatch_count
  FROM unnest(p_installment_ids, p_installment_updated_ats) WITH ORDINALITY AS snap(id, updated_at, ord)
  JOIN public.payment_installments pi ON pi.id = snap.id
  WHERE pi.extra_payment_request_id IS DISTINCT FROM p_extra_payment_request_id
     OR pi.source_type <> 'extra_payment'
     OR pi.client_id IS DISTINCT FROM v_request_client_id
     OR pi.status <> 'pendente_aprovacao'
     OR pi.updated_at <> snap.updated_at;
  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Este pedido foi alterado. Nada foi aprovado; revise novamente.';
  END IF;

  SELECT COALESCE(SUM(value), 0) INTO v_installments_sum
    FROM public.payment_installments
    WHERE id = ANY(p_installment_ids);
  IF v_installments_sum <> v_request_amount THEN
    RAISE EXCEPTION 'A soma das parcelas não corresponde ao valor do pedido.';
  END IF;

  -- Aprova somente o cabeçalho; o trigger AFTER propaga para as parcelas.
  UPDATE public.extra_payment_requests
    SET status = 'aprovado'
    WHERE id = p_extra_payment_request_id
      AND status = 'pendente_aprovacao';
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Este pedido foi alterado. Nada foi aprovado; revise novamente.';
  END IF;

  SELECT COUNT(*) INTO v_still_pending
    FROM public.payment_installments
    WHERE id = ANY(p_installment_ids)
      AND status <> 'aprovado';
  IF v_still_pending > 0 THEN
    RAISE EXCEPTION 'Não foi possível aprovar o pagamento extra.';
  END IF;

  RETURN QUERY SELECT array_length(p_installment_ids, 1), p_installment_ids;
END;
$$;

-- ============================================================
-- 3) Trigger de transição de payment_installments (versão final)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_validate_payment_installment_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  v_header_status TEXT;
BEGIN
  NEW.updated_at := NOW();

  -- Sem mudança de status: edição financeira/documental só se pendente,
  -- e nunca sobre campos de identidade/origem/auditoria.
  IF NEW.status = OLD.status THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION
        'Edição não permitida: só é possível editar parcelas pendentes de aprovação.';
    END IF;
    IF NEW.id <> OLD.id
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.maintenance_order_id IS DISTINCT FROM OLD.maintenance_order_id
       OR NEW.extra_payment_request_id IS DISTINCT FROM OLD.extra_payment_request_id
       OR NEW.created_by_id IS DISTINCT FROM OLD.created_by_id
       OR NEW.payment_approved_by IS DISTINCT FROM OLD.payment_approved_by
       OR NEW.payment_approved_at IS DISTINCT FROM OLD.payment_approved_at
       OR NEW.paid_by IS DISTINCT FROM OLD.paid_by
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
    THEN
      RAISE EXCEPTION 'Edição não permitida: campos de identidade/auditoria são imutáveis.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();

  IF NEW.status IN ('aprovado', 'reprovado') THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível aprovar/reprovar uma parcela pendente de aprovação.';
    END IF;

    IF NEW.source_type = 'maintenance_order' THEN
      IF my_role IS NULL OR my_role NOT IN ('Coordinator', 'Manager', 'Director', 'Admin Master') THEN
        RAISE EXCEPTION 'Permissão negada: apenas Coordenador ou superior pode aprovar/reprovar parcelas.';
      END IF;
    ELSE
      -- Extra: a parcela só acompanha o status do cabeçalho (propagação AFTER);
      -- não existe aprovação/reprovação isolada de parcela extra.
      SELECT status INTO v_header_status
        FROM public.extra_payment_requests
        WHERE id = NEW.extra_payment_request_id;
      IF v_header_status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Permissão negada: parcelas de pagamento extra só transicionam junto com o cabeçalho do pedido.';
      END IF;
    END IF;

    NEW.payment_approved_by := auth.uid();
    NEW.payment_approved_at := NOW();
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    IF OLD.status <> 'aprovado' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível marcar como Pago uma parcela já aprovada.';
    END IF;
    IF my_role IS NULL OR my_role NOT IN ('Financeiro', 'Admin Master') THEN
      RAISE EXCEPTION 'Permissão negada: apenas Financeiro ou Admin Master pode marcar parcela como paga.';
    END IF;
    NEW.paid_by := auth.uid();
    NEW.paid_at := NOW();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

-- ============================================================
-- 4) Integridade de origem de payment_installments
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_validate_payment_installment_source_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_client_id UUID;
  v_request_client_id UUID;
  v_request_status TEXT;
BEGIN
  IF NEW.source_type = 'maintenance_order' THEN
    SELECT client_id INTO v_order_client_id
      FROM public.maintenance_orders WHERE id = NEW.maintenance_order_id;
    IF v_order_client_id IS NULL THEN
      RAISE EXCEPTION 'Ordem de serviço inválida para esta parcela.';
    END IF;
    IF v_order_client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'client_id da parcela diverge da ordem de serviço de origem.';
    END IF;
  ELSE
    SELECT client_id, status INTO v_request_client_id, v_request_status
      FROM public.extra_payment_requests WHERE id = NEW.extra_payment_request_id;
    IF v_request_client_id IS NULL THEN
      RAISE EXCEPTION 'Pedido de pagamento extra inválido para esta parcela.';
    END IF;
    IF v_request_client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'client_id da parcela diverge do pedido de pagamento extra de origem.';
    END IF;
    IF TG_OP = 'INSERT' AND v_request_status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Não é possível incluir parcelas em um pedido de pagamento extra que não está pendente de aprovação.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_installment_source_integrity ON public.payment_installments;
CREATE TRIGGER trg_validate_payment_installment_source_integrity
  BEFORE INSERT OR UPDATE OF client_id, source_type, maintenance_order_id, extra_payment_request_id
  ON public.payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_payment_installment_source_integrity();

-- ============================================================
-- 5) Trigger do cabeçalho extra_payment_requests (versão final)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_validate_extra_payment_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  v_installment_count INTEGER;
  v_pending_count INTEGER;
  v_installments_sum NUMERIC(12,2);
  v_non_paid_count INTEGER;
BEGIN
  NEW.updated_at := NOW();

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();

  IF NEW.status IN ('aprovado', 'reprovado') THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível aprovar/reprovar um pagamento extra pendente de aprovação.';
    END IF;
    IF my_role IS NULL OR my_role NOT IN ('Coordinator', 'Manager', 'Director', 'Admin Master') THEN
      RAISE EXCEPTION 'Permissão negada: apenas Coordenador ou superior pode aprovar/reprovar pagamentos extras.';
    END IF;

    IF NEW.status = 'reprovado' THEN
      IF NEW.rejection_reason IS NULL OR btrim(NEW.rejection_reason) = '' THEN
        RAISE EXCEPTION 'Motivo da reprovação é obrigatório.';
      END IF;
      NEW.rejected_by := auth.uid();
      NEW.rejected_at := NOW();
      RETURN NEW;
    END IF;

    -- Aprovação: exige ao menos uma parcela, todas pendentes, soma exata.
    -- Esta função só valida/preenche auditoria; não atualiza filhos aqui —
    -- a propagação é feita pelo trigger AFTER fn_sync_extra_payment_request_installments.
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pendente_aprovacao'), COALESCE(SUM(value), 0)
      INTO v_installment_count, v_pending_count, v_installments_sum
      FROM public.payment_installments
      WHERE extra_payment_request_id = NEW.id AND source_type = 'extra_payment';

    IF v_installment_count = 0 THEN
      RAISE EXCEPTION 'Este pedido não possui parcelas e não pode ser aprovado.';
    END IF;
    IF v_pending_count <> v_installment_count THEN
      RAISE EXCEPTION 'Não foi possível aprovar o pagamento extra.';
    END IF;
    IF v_installments_sum <> NEW.amount THEN
      RAISE EXCEPTION 'A soma das parcelas não corresponde ao valor do pedido.';
    END IF;

    NEW.approved_by := auth.uid();
    NEW.approved_at := NOW();
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado' THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível cancelar um pagamento extra pendente de aprovação.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    IF OLD.status <> 'aprovado' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível marcar como pago um pagamento extra aprovado.';
    END IF;
    IF my_role IS NULL OR my_role NOT IN ('Financeiro', 'Admin Master') THEN
      RAISE EXCEPTION 'Permissão negada: apenas Financeiro ou Admin Master pode marcar o pagamento extra como pago.';
    END IF;
    SELECT COUNT(*) FILTER (WHERE status <> 'pago')
      INTO v_non_paid_count
      FROM public.payment_installments
      WHERE extra_payment_request_id = NEW.id AND source_type = 'extra_payment';
    IF v_non_paid_count > 0 THEN
      RAISE EXCEPTION 'Não é possível marcar o pedido como pago enquanto houver parcelas não pagas.';
    END IF;
    NEW.paid_by := auth.uid();
    NEW.paid_at := NOW();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

-- ============================================================
-- 6) Propagação AFTER: cabeçalho extra -> parcelas
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_extra_payment_request_installments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pendente_aprovacao' AND NEW.status IN ('aprovado', 'reprovado') THEN
    UPDATE public.payment_installments
      SET status = NEW.status
      WHERE extra_payment_request_id = NEW.id
        AND source_type = 'extra_payment'
        AND status = 'pendente_aprovacao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_extra_payment_request_installments ON public.extra_payment_requests;
CREATE TRIGGER trg_sync_extra_payment_request_installments
  AFTER UPDATE OF status ON public.extra_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_extra_payment_request_installments();

-- ============================================================
-- 7) Propagação AFTER: última parcela extra paga -> cabeçalho pago
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_extra_payment_request_paid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_non_paid_count INTEGER;
BEGIN
  IF NEW.source_type <> 'extra_payment' OR NEW.status <> 'pago' OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_non_paid_count
    FROM public.payment_installments
    WHERE extra_payment_request_id = NEW.extra_payment_request_id
      AND status <> 'pago';

  IF v_non_paid_count = 0 THEN
    UPDATE public.extra_payment_requests
      SET status = 'pago'
      WHERE id = NEW.extra_payment_request_id
        AND status = 'aprovado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_extra_payment_request_paid_status ON public.payment_installments;
CREATE TRIGGER trg_sync_extra_payment_request_paid_status
  AFTER UPDATE OF status ON public.payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_extra_payment_request_paid_status();

-- ============================================================
-- 8) ACL das novas RPCs e reload do schema PostgREST
-- ============================================================

REVOKE ALL ON FUNCTION public.approve_maintenance_payment_group(UUID, UUID[], TIMESTAMPTZ[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_extra_payment_request_group(UUID, TIMESTAMPTZ, UUID[], TIMESTAMPTZ[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approve_maintenance_payment_group(UUID, UUID[], TIMESTAMPTZ[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_extra_payment_request_group(UUID, TIMESTAMPTZ, UUID[], TIMESTAMPTZ[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Rollback obrigatório (documentado — NUNCA executar automaticamente)
-- ============================================================
-- Antes de rodar qualquer linha abaixo: interromper o frontend que
-- chama as RPCs novas e restaurar as definições capturadas pelo
-- diagnóstico ANTES desta migration ter sido aplicada no ambiente.
--
-- DROP TRIGGER IF EXISTS trg_sync_extra_payment_request_paid_status ON public.payment_installments;
-- DROP FUNCTION IF EXISTS public.fn_sync_extra_payment_request_paid_status();
-- DROP TRIGGER IF EXISTS trg_sync_extra_payment_request_installments ON public.extra_payment_requests;
-- DROP FUNCTION IF EXISTS public.fn_sync_extra_payment_request_installments();
-- DROP TRIGGER IF EXISTS trg_validate_payment_installment_source_integrity ON public.payment_installments;
-- DROP FUNCTION IF EXISTS public.fn_validate_payment_installment_source_integrity();
-- DROP FUNCTION IF EXISTS public.approve_extra_payment_request_group(UUID, TIMESTAMPTZ, UUID[], TIMESTAMPTZ[]);
-- DROP FUNCTION IF EXISTS public.approve_maintenance_payment_group(UUID, UUID[], TIMESTAMPTZ[]);
-- -- Restaurar aqui, via CREATE OR REPLACE FUNCTION, as definições de
-- -- fn_validate_payment_installment_transition e
-- -- fn_validate_extra_payment_request_transition capturadas pelo
-- -- diagnóstico pré-migration daquele ambiente.
-- NOTIFY pgrst, 'reload schema';
