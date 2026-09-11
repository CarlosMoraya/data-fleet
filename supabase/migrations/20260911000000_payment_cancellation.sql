-- ============================================================
-- MIGRATION: payment_cancellation
-- Data: 2026-09-11
-- Descrição: Cancelamento de pagamentos aprovados, sem exclusão física.
--   - payment_installments ganha o status 'cancelado'.
--   - payment_installments e extra_payment_requests ganham
--     cancelled_by / cancelled_at / cancellation_reason.
--   - Parcela de OS: aprovado -> cancelado, só por quem aprovou a parcela
--     (payment_approved_by) ou Admin Master. Libera saldo da OS.
--   - Pagamento Extra: aprovado -> cancelado, só por quem aprovou o pedido
--     (approved_by) ou Admin Master, e só sem parcela 'pago'. As parcelas
--     pendentes/aprovadas acompanham o cabeçalho.
--   - pendente_aprovacao -> cancelado de Pagamento Extra (já existia)
--     passa a exigir motivo e a propagar para as parcelas.
--   - Pedido extra cancelado é terminal e imutável.
--   - Financeiro passa a ver pedidos extras cancelados que chegaram a ser
--     aprovados (approved_at IS NOT NULL) e as parcelas deles.
--   - Reparo idempotente: parcelas de pedidos já cancelados que ficaram
--     pendentes (PE-2608-0002 em PROD) passam a 'cancelado'.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Depois: supabase/diagnostics/check-payment-cancellation.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Colunas de cancelamento (aditivas, NULL por padrão)
-- ------------------------------------------------------------
ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE public.extra_payment_requests
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ------------------------------------------------------------
-- 2) Status 'cancelado' em payment_installments (só amplia o domínio)
-- ------------------------------------------------------------
ALTER TABLE public.payment_installments
  DROP CONSTRAINT IF EXISTS payment_installments_status_check;
ALTER TABLE public.payment_installments
  ADD CONSTRAINT payment_installments_status_check
  CHECK (status IN ('pendente_aprovacao', 'aprovado', 'reprovado', 'pago', 'cancelado'));

-- ------------------------------------------------------------
-- 3) Transição de payment_installments (versão 20260804 + cancelamento)
-- ------------------------------------------------------------
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
       OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
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

  -- NOVO (2026-09-11): cancelamento.
  IF NEW.status = 'cancelado' THEN
    IF NEW.cancellation_reason IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório.';
    END IF;

    IF NEW.source_type = 'maintenance_order' THEN
      IF OLD.status <> 'aprovado' THEN
        RAISE EXCEPTION 'Transição inválida: só é possível cancelar uma parcela aprovada.';
      END IF;
      -- Fail Closed: sem sessão não há autor, e NULL nunca conta como
      -- "é o aprovador". Não há escape hatch neste ramo.
      IF auth.uid() IS NULL
         OR (my_role IS DISTINCT FROM 'Admin Master'
             AND OLD.payment_approved_by IS DISTINCT FROM auth.uid()) THEN
        RAISE EXCEPTION 'Permissão negada: apenas quem aprovou a parcela ou o Admin Master pode cancelá-la.';
      END IF;
    ELSE
      IF OLD.status NOT IN ('pendente_aprovacao', 'aprovado') THEN
        RAISE EXCEPTION 'Transição inválida: só é possível cancelar parcela extra pendente ou aprovada.';
      END IF;
      -- Parcela extra só é cancelada pela propagação do cabeçalho.
      SELECT status INTO v_header_status
        FROM public.extra_payment_requests
        WHERE id = NEW.extra_payment_request_id;
      IF v_header_status IS DISTINCT FROM 'cancelado' THEN
        RAISE EXCEPTION 'Permissão negada: parcelas de pagamento extra só são canceladas junto com o pedido.';
      END IF;
    END IF;

    NEW.cancelled_by := auth.uid();
    NEW.cancelled_at := NOW();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

-- ------------------------------------------------------------
-- 4) Transição de extra_payment_requests (versão 20260804 + cancelamento)
-- ------------------------------------------------------------
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
  v_paid_count INTEGER;
BEGIN
  NEW.updated_at := NOW();

  -- NOVO (2026-09-11): pedido cancelado é terminal e imutável.
  IF OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Edição não permitida: pagamento extra cancelado não pode ser alterado.';
  END IF;

  IF NEW.status = OLD.status THEN
    -- NOVO (2026-09-11): campos de cancelamento só nascem no cancelamento.
    IF NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
    THEN
      RAISE EXCEPTION 'Edição não permitida: campos de cancelamento só são gravados no cancelamento.';
    END IF;
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

  -- ALTERADO (2026-09-11): exige motivo, aceita 'aprovado' com trava de
  -- autor e de parcela lançada, e grava autor/data.
  IF NEW.status = 'cancelado' THEN
    IF NEW.cancellation_reason IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório.';
    END IF;

    IF OLD.status = 'aprovado' THEN
      IF auth.uid() IS NULL
         OR (my_role IS DISTINCT FROM 'Admin Master'
             AND OLD.approved_by IS DISTINCT FROM auth.uid()) THEN
        RAISE EXCEPTION 'Permissão negada: apenas quem aprovou o pagamento extra ou o Admin Master pode cancelá-lo.';
      END IF;
      -- Trava as parcelas antes de conferir: o Financeiro não consegue
      -- lançar uma parcela entre esta checagem e a propagação AFTER.
      PERFORM 1
        FROM public.payment_installments
        WHERE extra_payment_request_id = NEW.id
          AND source_type = 'extra_payment'
        FOR UPDATE;
      SELECT COUNT(*) INTO v_paid_count
        FROM public.payment_installments
        WHERE extra_payment_request_id = NEW.id
          AND source_type = 'extra_payment'
          AND status = 'pago';
      IF v_paid_count > 0 THEN
        RAISE EXCEPTION 'Não é possível cancelar: há parcela deste pagamento extra já lançada no sistema.';
      END IF;
    ELSIF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível cancelar um pagamento extra pendente de aprovação ou aprovado.';
    END IF;

    NEW.cancelled_by := auth.uid();
    NEW.cancelled_at := NOW();
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

-- ------------------------------------------------------------
-- 5) Propagação AFTER: cabeçalho extra -> parcelas (+ cancelamento)
-- ------------------------------------------------------------
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

  -- NOVO (2026-09-11)
  IF OLD.status IN ('pendente_aprovacao', 'aprovado') AND NEW.status = 'cancelado' THEN
    UPDATE public.payment_installments
      SET status = 'cancelado',
          cancellation_reason = NEW.cancellation_reason
      WHERE extra_payment_request_id = NEW.id
        AND source_type = 'extra_payment'
        AND status IN ('pendente_aprovacao', 'aprovado');
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 6) Teto de orçamento: parcela cancelada devolve saldo, como a reprovada
-- ------------------------------------------------------------
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
  IF NEW.source_type <> 'maintenance_order' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.value = OLD.value THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(approved_cost, 0)
    INTO v_budget
    FROM public.maintenance_orders
    WHERE id = NEW.maintenance_order_id;

  SELECT COALESCE(SUM(value), 0)
    INTO v_existing
    FROM public.payment_installments
    WHERE maintenance_order_id = NEW.maintenance_order_id
      AND status NOT IN ('reprovado', 'cancelado')
      AND id <> NEW.id;

  IF (v_existing + NEW.value) > v_budget THEN
    RAISE EXCEPTION
      'Valor excede o orçamento aprovado (%). Saldo disponível: %.',
      v_budget, (v_budget - v_existing);
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 7) RLS de leitura: Financeiro vê extras cancelados que foram aprovados
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "extra_payment_requests_select" ON public.extra_payment_requests;
CREATE POLICY "extra_payment_requests_select" ON public.extra_payment_requests
  FOR SELECT TO authenticated
  USING (
    (
      public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
      AND client_id = public.get_my_client_id()
    )
    OR public.is_admin_master()
    OR (
      public.get_my_role() = 'Financeiro'
      AND client_id = public.get_my_client_id()
      AND (
        status IN ('aprovado', 'pago')
        OR (status = 'cancelado' AND approved_at IS NOT NULL)
      )
    )
  );

DROP POLICY IF EXISTS "payment_installments_select" ON public.payment_installments;
CREATE POLICY "payment_installments_select" ON public.payment_installments
  FOR SELECT TO authenticated
  USING (
    (
      public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Financeiro'
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        source_type = 'maintenance_order'
        OR (
          source_type = 'extra_payment'
          AND extra_payment_request_id IN (
            SELECT id FROM public.extra_payment_requests
            WHERE status IN ('aprovado', 'pago')
               OR (status = 'cancelado' AND approved_at IS NOT NULL)
          )
        )
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND source_type = 'maintenance_order'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid() AND wp.status = 'active' AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
  );

-- ------------------------------------------------------------
-- 8) RPCs de auditoria ganham cancelled_by_name
--    (mudar RETURNS TABLE exige DROP + CREATE; atômico dentro do BEGIN)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_extra_payment_auditors(UUID);
CREATE FUNCTION public.get_extra_payment_auditors(p_extra_payment_request_id UUID)
RETURNS TABLE (
  created_by_name   TEXT,
  approved_by_name  TEXT,
  rejected_by_name  TEXT,
  paid_by_name      TEXT,
  cancelled_by_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    creator.name   AS created_by_name,
    approver.name  AS approved_by_name,
    rejecter.name  AS rejected_by_name,
    payer.name     AS paid_by_name,
    canceller.name AS cancelled_by_name
  FROM public.extra_payment_requests epr
  LEFT JOIN public.profiles creator   ON creator.id   = epr.created_by_id
  LEFT JOIN public.profiles approver  ON approver.id  = epr.approved_by
  LEFT JOIN public.profiles rejecter  ON rejecter.id  = epr.rejected_by
  LEFT JOIN public.profiles payer     ON payer.id     = epr.paid_by
  LEFT JOIN public.profiles canceller ON canceller.id = epr.cancelled_by
  WHERE epr.id = p_extra_payment_request_id
    AND (
      epr.client_id = public.get_my_client_id()
      OR public.is_admin_master()
      OR (
        public.get_my_role() = 'Financeiro'
        AND epr.client_id = public.get_my_client_id()
        AND epr.status IN ('aprovado', 'pago')
      )
    );
$$;
REVOKE ALL ON FUNCTION public.get_extra_payment_auditors(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_extra_payment_auditors(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.get_payment_installment_auditors(UUID);
CREATE FUNCTION public.get_payment_installment_auditors(p_installment_id UUID)
RETURNS TABLE (
  budget_approved_by_name  TEXT,
  payment_approved_by_name TEXT,
  paid_by_name             TEXT,
  cancelled_by_name        TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    budget_reviewer.name  AS budget_approved_by_name,
    payment_approver.name AS payment_approved_by_name,
    payer.name            AS paid_by_name,
    canceller.name        AS cancelled_by_name
  FROM public.payment_installments pi
  JOIN public.maintenance_orders mo ON mo.id = pi.maintenance_order_id
  LEFT JOIN public.profiles budget_reviewer  ON budget_reviewer.id  = mo.budget_reviewed_by
  LEFT JOIN public.profiles payment_approver ON payment_approver.id = pi.payment_approved_by
  LEFT JOIN public.profiles payer            ON payer.id            = pi.paid_by
  LEFT JOIN public.profiles canceller        ON canceller.id        = pi.cancelled_by
  WHERE pi.id = p_installment_id
    AND (
      pi.client_id = public.get_my_client_id()
      OR public.get_my_role() = 'Admin Master'
      OR (
        public.get_my_role() = 'Workshop'
        AND mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid()
            AND wp.status = 'active'
            AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    );
$$;
REVOKE ALL ON FUNCTION public.get_payment_installment_auditors(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_installment_auditors(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 9) Reparo idempotente: parcelas órfãs de pedidos já cancelados
--    (PROD: PE-2608-0002, 1 parcela de R$ 300,00; DEV: 0 esperadas).
--    Pelo SQL Editor auth.uid() é NULL: o gatilho aceita porque o
--    cabeçalho já está 'cancelado'; cancelled_by fica NULL e o evento de
--    auditoria registra 'service_role'.
-- ------------------------------------------------------------
UPDATE public.payment_installments pi
   SET status = 'cancelado',
       cancellation_reason = 'Reparo 2026-09-11: pedido de pagamento extra cancelado antes da propagação automática para as parcelas.'
  FROM public.extra_payment_requests epr
 WHERE pi.extra_payment_request_id = epr.id
   AND pi.source_type = 'extra_payment'
   AND epr.status = 'cancelado'
   AND pi.status IN ('pendente_aprovacao', 'aprovado');

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- Rollback (documentado — NUNCA executar automaticamente)
-- ============================================================
-- 1. Rollback de código é imediato: reverter o frontend. A migration é
--    compatível com o frontend anterior, exceto que o cancelamento de
--    pendente pelo criador passa a exigir motivo.
-- 2. Rollback de banco com parcelas já canceladas exige decisão do
--    usuário ANTES: não recriar o CHECK antigo de status enquanto
--    existir linha 'cancelado' em payment_installments.
--      SELECT count(*) FROM public.payment_installments WHERE status = 'cancelado';
-- 3. Restaurar, via CREATE OR REPLACE, as quatro funções como estão em
--    20260804000000_secure_financial_approval_groups.sql (seções 3, 5, 6)
--    e 20260712000000_create_extra_payment_requests.sql (seção 6, teto).
-- 4. Recriar extra_payment_requests_select e payment_installments_select
--    como em 20260712000000 (Financeiro: status IN ('aprovado','pago')).
-- 5. DROP + CREATE das duas RPCs de auditoria sem cancelled_by_name,
--    como em 20260712000000 (seção 9) e na definição vigente de
--    get_payment_installment_auditors capturada em 2026-09-11.
-- 6. As colunas cancelled_* podem permanecer (aditivas e inertes).
-- NOTIFY pgrst, 'reload schema';
