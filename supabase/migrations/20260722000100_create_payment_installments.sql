-- ============================================================
-- MIGRATION: create_payment_installments
-- Data: 2026-07-08
-- Descrição: Parcelas de pagamento desdobradas de uma OS de manutenção
--            com orçamento aprovado. Ciclo de vida (state machine):
--            pendente_aprovacao → aprovado/reprovado → pago.
--            RLS por client_id (Padrão de Ouro), clonada de
--            maintenance_part_photos, com cláusula explícita para
--            'Financeiro'. A trava de QUAL transição cada cargo pode
--            fazer é imposta pelo trigger, não só pela policy.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_order_id UUID NOT NULL REFERENCES public.maintenance_orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  installments_total INT NOT NULL,
  value NUMERIC(12,2) NOT NULL CHECK (value > 0),
  due_date DATE NOT NULL,
  competencia_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK (status IN ('pendente_aprovacao', 'aprovado', 'reprovado', 'pago')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('boleto', 'pix')),
  boleto_url TEXT,
  nota_fiscal_url TEXT,
  pix_key_type TEXT CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_key TEXT,
  pix_beneficiary_name TEXT,
  categoria TEXT,
  centro_custo TEXT,
  descricao TEXT,
  notes TEXT,
  created_by_id UUID REFERENCES public.profiles(id),
  payment_approved_by UUID REFERENCES public.profiles(id),
  payment_approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pi_order  ON public.payment_installments(maintenance_order_id);
CREATE INDEX IF NOT EXISTS idx_pi_client ON public.payment_installments(client_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON public.payment_installments(status);

-- ============================================================
-- Row Level Security
-- ============================================================

-- SELECT: Fleet Assistant+ (próprio tenant) OU Admin Master
--         OU Financeiro (próprio tenant) OU Workshop (OS da sua oficina).
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
    )
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
  );

-- INSERT: created_by_id = usuário atual E (Fleet Assistant+ do tenant OU
--         Admin Master OU Workshop da sua OS). Financeiro NÃO insere.
CREATE POLICY "payment_installments_insert" ON public.payment_installments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_id = auth.uid()
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
  );

-- UPDATE: Fleet Assistant+ (tenant), Admin Master, Financeiro (tenant, marcar pago)
--         e Workshop (sua OS). A validação de QUAL transição cada cargo pode
--         executar é imposta pelo trigger fn_validate_payment_installment_transition.
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

-- DELETE: Fleet Assistant+ (tenant) e Admin Master sempre;
--         Workshop SOMENTE enquanto a parcela ainda está pendente de aprovação.
--         Financeiro não deleta.
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
-- Trigger de transição de status (State Machine)
-- ============================================================
-- Transições válidas:
--   pendente_aprovacao → aprovado  (Coordinator+ / Admin Master)
--   pendente_aprovacao → reprovado (Coordinator+ / Admin Master)
--   aprovado           → pago      (Financeiro / Admin Master / role_rank >= 3)
-- Qualquer outra transição é rejeitada. Edições sem mudança de status passam.
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

  -- Sem mudança de status: edição de campos permitida, nada a validar.
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = auth.uid();
  my_rank := public.role_rank(my_role);

  -- → aprovado / reprovado: só Coordinator+ ou Admin Master, a partir de pendente.
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

  -- → pago: só a partir de aprovado, por Financeiro / Admin Master / role_rank >= 3.
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

  -- Qualquer outra transição (ex.: voltar para pendente_aprovacao) é inválida.
  RAISE EXCEPTION 'Transição de status inválida: % -> %.', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_installment_transition ON public.payment_installments;
CREATE TRIGGER trg_validate_payment_installment_transition
  BEFORE UPDATE ON public.payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_payment_installment_transition();

NOTIFY pgrst, 'reload schema';
