-- ============================================================
-- MIGRATION: harden_payment_installment_insert
-- Data: 2026-09-12
-- Descrição: Fecha a brecha de PRIORIDADE ALTA registrada em
--   docs/MEMORY.md (descoberta em 2026-09-10, pré-existente desde
--   2026-07-08): fn_validate_payment_installment_transition é só
--   BEFORE UPDATE, e o DEFAULT 'pendente_aprovacao' só vale quando
--   o campo não é enviado. Qualquer papel com porta de INSERT na RLS
--   (Fleet Assistant+, Admin Master, Workshop na própria OS) podia
--   criar parcela já 'aprovado' ou 'pago' mandando o campo direto à
--   API, pulando a aprovação do Coordenador.
--
--   A correção segue o padrão JÁ EXISTENTE na tabela irmã
--   extra_payment_requests, cuja policy de INSERT traz
--   AND status = 'pendente_aprovacao' no WITH CHECK. NÃO é gatilho —
--   ver IMPLEMENTATION.md, "Decisão de projeto que NÃO deve ser
--   corrigida".
--
--   O corpo da policy é idêntico ao vigente (origem: migration
--   20260712000000, linhas 200-245). A ÚNICA diferença são as oito
--   cláusulas do bloco marcado NOVO abaixo.
--
--   Medição prévia (2026-09-11, DEV e PROD): 0 parcelas criadas com
--   status diferente de 'pendente_aprovacao'. Não há dado a reparar,
--   e por isso esta migration não escreve nenhuma linha.
--
--   Reparo manual por SQL Editor / service_role continua liberado:
--   RLS não se aplica a service_role. É o mesmo efeito prático do
--   escape hatch auth.uid() IS NULL dos gatilhos do módulo.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Depois: supabase/diagnostics/check-payment-installment-insert-status.sql
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "payment_installments_insert" ON public.payment_installments;
CREATE POLICY "payment_installments_insert" ON public.payment_installments
  FOR INSERT TO authenticated
  WITH CHECK (
    -- ─── NOVO (2026-09-12): parcela nasce pendente e sem auditoria ───
    status = 'pendente_aprovacao'
    AND payment_approved_by IS NULL
    AND payment_approved_at IS NULL
    AND paid_by IS NULL
    AND paid_at IS NULL
    AND cancelled_by IS NULL
    AND cancelled_at IS NULL
    AND cancellation_reason IS NULL
    -- ─── FIM DO BLOCO NOVO — daqui para baixo é idêntico ao vigente ───
    AND created_by_id = auth.uid()
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

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- Rollback (documentado — NUNCA executar automaticamente)
-- ============================================================
-- Rollback é uma operação só: recriar a policy sem o bloco NOVO,
-- exatamente como está em 20260712000000_create_extra_payment_requests.sql,
-- linhas 200-245. Nenhum dado precisa ser tocado, porque esta migration
-- não escreve nenhuma linha e nenhuma coluna muda de tipo ou de nome.
--
-- ATENÇÃO: rollback REABRE a brecha de escalação de status. Só executar
-- com decisão explícita do usuário, e registrar em docs/MEMORY.md.
