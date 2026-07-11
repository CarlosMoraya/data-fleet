-- ============================================================
-- MIGRATION: payment_installment_auditors_rpc
-- Data: 2026-07-10
-- Descrição: Resolve os nomes de auditoria de uma parcela de pagamento
--            (aprovador do orçamento, aprovador do pagamento e pagador)
--            para QUALQUER papel que já possa ver a parcela — inclusive
--            'Financeiro', que não tem RLS de leitura em public.profiles.
--            SECURITY DEFINER para ler profiles; a trava de visibilidade
--            por tenant é reimposta no WHERE (espelha a policy
--            payment_installments_select). Retorna somente o NAME.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_payment_installment_auditors(p_installment_id UUID)
RETURNS TABLE (
  budget_approved_by_name  TEXT,
  payment_approved_by_name TEXT,
  paid_by_name             TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    budget_reviewer.name  AS budget_approved_by_name,
    payment_approver.name AS payment_approved_by_name,
    payer.name            AS paid_by_name
  FROM public.payment_installments pi
  JOIN public.maintenance_orders mo ON mo.id = pi.maintenance_order_id
  LEFT JOIN public.profiles budget_reviewer  ON budget_reviewer.id  = mo.budget_reviewed_by
  LEFT JOIN public.profiles payment_approver ON payment_approver.id = pi.payment_approved_by
  LEFT JOIN public.profiles payer            ON payer.id            = pi.paid_by
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

GRANT EXECUTE ON FUNCTION public.get_payment_installment_auditors(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
