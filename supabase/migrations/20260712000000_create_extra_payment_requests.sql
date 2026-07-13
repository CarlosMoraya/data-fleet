-- ============================================================
-- MIGRATION: create_extra_payment_requests
-- Data: 2026-07-12
-- Descrição: Domínio de Pagamentos Extras / Serviços Avulsos
--            (guincho, chaveiro, borracheiro, Uber/táxi, etc.),
--            sem vínculo obrigatório com OS de manutenção.
--            Generaliza public.payment_installments para aceitar
--            origem 'maintenance_order' ou 'extra_payment', em vez
--            de criar uma segunda tabela de parcelas.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ============================================================
-- 1) Tabela extra_payment_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.extra_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('guincho', 'borracheiro', 'chaveiro', 'uber', 'taxi', 'frete_apoio', 'outro')),
  service_date DATE NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_document TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  justification TEXT,
  notes TEXT,
  receipt_url TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK (status IN ('pendente_aprovacao', 'aprovado', 'reprovado', 'pago', 'cancelado')),
  created_by_id UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.extra_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS extra_payment_requests_client_number_uniq
  ON public.extra_payment_requests(client_id, request_number);

CREATE INDEX IF NOT EXISTS idx_epr_client_status ON public.extra_payment_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_epr_vehicle ON public.extra_payment_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_epr_driver ON public.extra_payment_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_epr_created_at ON public.extra_payment_requests(created_at);

-- ============================================================
-- 2) RLS de extra_payment_requests
-- ============================================================

-- SELECT: Fleet Assistant+ do próprio tenant, Admin Master (cross-tenant),
--         Financeiro do próprio tenant somente quando aprovado/pago.
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
      AND status IN ('aprovado', 'pago')
    )
  );

-- INSERT: criado pelo próprio usuário, Fleet Assistant+ do tenant,
--         sempre nascendo pendente_aprovacao. Workshop e Financeiro não inserem.
CREATE POLICY "extra_payment_requests_insert" ON public.extra_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_id = auth.uid()
    AND status = 'pendente_aprovacao'
    AND (
      (
        public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
        AND client_id = public.get_my_client_id()
        AND public.get_my_role() NOT IN ('Workshop', 'Financeiro')
      )
      OR public.is_admin_master()
    )
  );

-- UPDATE: Coordinator+/Admin Master aprovam/reprovam/cancelam conforme trigger;
--         Financeiro só grava via marcação de parcela paga (trigger de payment_installments
--         atualiza o cabeçalho via SECURITY DEFINER), então não recebe policy de UPDATE direto.
CREATE POLICY "extra_payment_requests_update" ON public.extra_payment_requests
  FOR UPDATE TO authenticated
  USING (
    (
      public.role_rank(public.get_my_role()) >= public.role_rank('Coordinator')
      AND client_id = public.get_my_client_id()
    )
    OR public.is_admin_master()
    OR (
      created_by_id = auth.uid()
      AND status = 'pendente_aprovacao'
      AND client_id = public.get_my_client_id()
    )
  )
  WITH CHECK (
    (
      public.role_rank(public.get_my_role()) >= public.role_rank('Coordinator')
      AND client_id = public.get_my_client_id()
    )
    OR public.is_admin_master()
    OR (
      created_by_id = auth.uid()
      AND status = 'cancelado'
      AND client_id = public.get_my_client_id()
    )
  );

-- DELETE: não há policy de DELETE para usuários comuns; cancelamento é por status.

-- ============================================================
-- 3) Generalização de payment_installments (origem mista)
-- ============================================================

ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'maintenance_order'
    CHECK (source_type IN ('maintenance_order', 'extra_payment')),
  ADD COLUMN IF NOT EXISTS extra_payment_request_id UUID
    REFERENCES public.extra_payment_requests(id) ON DELETE CASCADE;

ALTER TABLE public.payment_installments
  ALTER COLUMN maintenance_order_id DROP NOT NULL;

UPDATE public.payment_installments
  SET source_type = 'maintenance_order'
  WHERE source_type IS NULL;

ALTER TABLE public.payment_installments
  DROP CONSTRAINT IF EXISTS payment_installments_source_check;
ALTER TABLE public.payment_installments
  ADD CONSTRAINT payment_installments_source_check
  CHECK (
    (source_type = 'maintenance_order' AND maintenance_order_id IS NOT NULL AND extra_payment_request_id IS NULL)
    OR
    (source_type = 'extra_payment' AND extra_payment_request_id IS NOT NULL AND maintenance_order_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_pi_source ON public.payment_installments(source_type, extra_payment_request_id);

-- ============================================================
-- 4) Recriação das policies de payment_installments (origem mista)
-- ============================================================

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
            SELECT id FROM public.extra_payment_requests WHERE status IN ('aprovado', 'pago')
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

DROP POLICY IF EXISTS "payment_installments_insert" ON public.payment_installments;
CREATE POLICY "payment_installments_insert" ON public.payment_installments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_id = auth.uid()
    AND (
      (
        source_type = 'maintenance_order'
        AND (
          (
            public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
            AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
          )
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
          OR (
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
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
        )
      )
      OR (
        source_type = 'extra_payment'
        AND (
          (
            public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
            AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('Workshop', 'Financeiro')
          )
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
        )
        AND extra_payment_request_id IN (
          SELECT id FROM public.extra_payment_requests WHERE client_id = payment_installments.client_id
        )
      )
    )
  );

DROP POLICY IF EXISTS "payment_installments_update" ON public.payment_installments;
CREATE POLICY "payment_installments_update" ON public.payment_installments
  FOR UPDATE TO authenticated
  USING (
    (
      public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Financeiro'
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
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
  )
  WITH CHECK (
    (
      public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Financeiro'
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
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

DROP POLICY IF EXISTS "payment_installments_delete" ON public.payment_installments;
CREATE POLICY "payment_installments_delete" ON public.payment_installments
  FOR DELETE TO authenticated
  USING (
    (
      public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND source_type = 'maintenance_order'
      AND status = 'pendente_aprovacao'
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

-- ============================================================
-- 5) Recriação de fn_validate_payment_installment_transition
--    (preserva manutenção; adiciona regra de aprovação/pagamento de extras
--     e sincroniza o cabeçalho de extra_payment_requests)
-- ============================================================

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
    IF NEW.source_type = 'extra_payment' THEN
      IF NOT (my_role = 'Financeiro' OR my_role = 'Admin Master') THEN
        RAISE EXCEPTION 'Permissão negada: apenas Financeiro ou Admin Master pode marcar parcela extra como paga.';
      END IF;
    ELSE
      IF NOT (my_role = 'Financeiro' OR my_role = 'Admin Master' OR my_rank >= 3) THEN
        RAISE EXCEPTION 'Permissão negada: cargo sem permissão para marcar parcela como paga.';
      END IF;
    END IF;
    NEW.paid_by := auth.uid();
    NEW.paid_at := NOW();

    IF NEW.source_type = 'extra_payment' AND NEW.extra_payment_request_id IS NOT NULL THEN
      UPDATE public.extra_payment_requests
        SET status = 'pago', paid_by = auth.uid(), paid_at = NOW(), updated_at = NOW()
        WHERE id = NEW.extra_payment_request_id;
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

-- ============================================================
-- 6) Recriação de fn_enforce_payment_installment_budget_cap
--    (teto de orçamento só se aplica a parcelas de manutenção)
-- ============================================================

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

-- ============================================================
-- 7) Trigger de aprovação/reprovação do cabeçalho de extra_payment_requests
--    (state machine própria: pendente_aprovacao -> aprovado/reprovado/cancelado)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_validate_extra_payment_request_transition()
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

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();
  my_rank := public.role_rank(my_role);

  IF NEW.status IN ('aprovado', 'reprovado') THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível aprovar/reprovar um pagamento extra pendente de aprovação.';
    END IF;
    IF NOT (my_role = 'Admin Master' OR my_rank >= public.role_rank('Coordinator')) THEN
      RAISE EXCEPTION 'Permissão negada: apenas Coordenador ou superior pode aprovar/reprovar pagamentos extras.';
    END IF;
    IF NEW.status = 'reprovado' AND (NEW.rejection_reason IS NULL OR btrim(NEW.rejection_reason) = '') THEN
      RAISE EXCEPTION 'Motivo da reprovação é obrigatório.';
    END IF;
    IF NEW.status = 'aprovado' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := NOW();
    ELSE
      NEW.rejected_by := auth.uid();
      NEW.rejected_at := NOW();
    END IF;

    UPDATE public.payment_installments
      SET status = NEW.status
      WHERE extra_payment_request_id = NEW.id
        AND source_type = 'extra_payment'
        AND status = 'pendente_aprovacao';

    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado' THEN
    IF OLD.status <> 'pendente_aprovacao' THEN
      RAISE EXCEPTION 'Transição inválida: só é possível cancelar um pagamento extra pendente de aprovação.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    -- Sincronizado automaticamente pelo trigger de payment_installments; não aceita
    -- transição direta feita pelo cliente da API.
    RAISE EXCEPTION 'Transição inválida: status pago é definido ao marcar a parcela extra como paga.';
  END IF;

  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_extra_payment_request_transition ON public.extra_payment_requests;
CREATE TRIGGER trg_validate_extra_payment_request_transition
  BEFORE UPDATE ON public.extra_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_extra_payment_request_transition();

-- ============================================================
-- 8) RPC: próximo número de Pagamento Extra (PE-YYMM-0001)
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_extra_payment_request_number(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_next INT;
  v_pattern TEXT;
BEGIN
  v_prefix := 'PE-' || to_char(NOW(), 'YYMM') || '-';
  v_pattern := v_prefix || '%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM LENGTH(v_prefix) + 1) AS INT)), 0) + 1
    INTO v_next
    FROM public.extra_payment_requests
    WHERE client_id = p_client_id
      AND request_number LIKE v_pattern
      AND SUBSTRING(request_number FROM LENGTH(v_prefix) + 1) ~ '^\d+$';

  RETURN v_prefix || LPAD(v_next::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_extra_payment_request_number(UUID) TO authenticated;

-- ============================================================
-- 9) RPC: nomes de auditoria de um Pagamento Extra
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_extra_payment_auditors(p_extra_payment_request_id UUID)
RETURNS TABLE (
  created_by_name  TEXT,
  approved_by_name TEXT,
  rejected_by_name TEXT,
  paid_by_name     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    creator.name  AS created_by_name,
    approver.name AS approved_by_name,
    rejecter.name AS rejected_by_name,
    payer.name    AS paid_by_name
  FROM public.extra_payment_requests epr
  LEFT JOIN public.profiles creator  ON creator.id  = epr.created_by_id
  LEFT JOIN public.profiles approver ON approver.id = epr.approved_by
  LEFT JOIN public.profiles rejecter ON rejecter.id = epr.rejected_by
  LEFT JOIN public.profiles payer    ON payer.id    = epr.paid_by
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

GRANT EXECUTE ON FUNCTION public.get_extra_payment_auditors(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
