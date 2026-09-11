-- ============================================================
-- DIAGNÓSTICO: cancelamento de pagamentos aprovados
-- Data: 2026-09-11 — acompanha 20260911000000_payment_cancellation.sql
-- SOMENTE LEITURA. Rodar em DEV e em PROD após aplicar a migration.
--
-- LIMITAÇÃO: este arquivo verifica ESTRUTURA. O comportamento dos
-- gatilhos com usuário autenticado está em
-- check-payment-cancellation-behavior.sql (somente DEV).
-- ============================================================

-- 1) Colunas de cancelamento nas duas tabelas.
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('payment_installments', 'extra_payment_requests')
   AND column_name IN ('cancelled_by', 'cancelled_at', 'cancellation_reason')
 ORDER BY table_name, column_name;
-- Esperado: 6 linhas (3 por tabela):
--   cancellation_reason = text, cancelled_at = timestamp with time zone,
--   cancelled_by = uuid.

-- 2) O domínio de status de payment_installments aceita 'cancelado'.
SELECT position('''cancelado''' IN pg_get_constraintdef(oid)) > 0 AS accepts_cancelado
  FROM pg_constraint
 WHERE conname = 'payment_installments_status_check'
   AND conrelid = 'public.payment_installments'::regclass;
-- Esperado: 1 linha, accepts_cancelado = t.

-- 3) Marcadores no corpo das quatro funções recriadas.
SELECT
  position('Motivo do cancelamento é obrigatório.' IN prosrc) > 0               AS requires_reason,
  position('OLD.payment_approved_by IS DISTINCT FROM auth.uid()' IN prosrc) > 0 AS checks_approver,
  position('auth.uid() IS NULL' IN prosrc) > 0                                  AS fail_closed_null_uid,
  position('só são canceladas junto com o pedido' IN prosrc) > 0                AS extra_only_via_header,
  position('NEW.cancelled_by := auth.uid()' IN prosrc) > 0                      AS stamps_cancelled_by,
  prosecdef                                                                     AS is_security_definer
  FROM pg_proc
 WHERE proname = 'fn_validate_payment_installment_transition'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: 1 linha, todas as colunas = t.

SELECT
  position('OLD.approved_by IS DISTINCT FROM auth.uid()' IN prosrc) > 0         AS checks_approver,
  position('FOR UPDATE' IN prosrc) > 0                                          AS locks_installments,
  position('já lançada no sistema' IN prosrc) > 0                               AS blocks_paid_installment,
  position('pagamento extra cancelado não pode ser alterado' IN prosrc) > 0     AS cancelled_is_terminal,
  prosecdef                                                                     AS is_security_definer
  FROM pg_proc
 WHERE proname = 'fn_validate_extra_payment_request_transition'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: 1 linha, todas as colunas = t.

SELECT
  position('cancellation_reason = NEW.cancellation_reason' IN prosrc) > 0       AS propagates_cancellation,
  prosecdef                                                                     AS is_security_definer
  FROM pg_proc
 WHERE proname = 'fn_sync_extra_payment_request_installments'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: 1 linha, todas as colunas = t.

SELECT
  position('NOT IN (''reprovado'', ''cancelado'')' IN prosrc) > 0               AS cancelled_releases_budget,
  prosecdef                                                                     AS is_security_definer
  FROM pg_proc
 WHERE proname = 'fn_enforce_payment_installment_budget_cap'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: 1 linha, todas as colunas = t.

-- 4) Policies de leitura: Financeiro vê extras cancelados que foram aprovados.
SELECT tablename,
       policyname,
       roles::text AS roles,
       position('approved_at IS NOT NULL' IN qual) > 0 AS financeiro_sees_cancelled_approved
  FROM pg_policies
 WHERE schemaname = 'public'
   AND policyname IN ('extra_payment_requests_select', 'payment_installments_select')
 ORDER BY tablename;
-- Esperado: 2 linhas, roles = {authenticated},
--   financeiro_sees_cancelled_approved = t.

-- 5) RPCs de auditoria: coluna nova e grants.
SELECT proname,
       position('cancelled_by_name text' IN pg_get_function_result(oid)) > 0 AS returns_cancelled_by_name,
       position('anon=' IN coalesce(proacl::text, '')) = 0                    AS no_anon,
       position('authenticated=' IN coalesce(proacl::text, '')) > 0           AS has_authenticated,
       prosecdef                                                              AS is_security_definer
  FROM pg_proc
 WHERE proname IN ('get_extra_payment_auditors', 'get_payment_installment_auditors')
   AND pronamespace = 'public'::regnamespace
 ORDER BY proname;
-- Esperado: 2 linhas, todas as colunas booleanas = t.

-- 6) Parcelas órfãs: pedido extra cancelado com parcela não cancelada.
SELECT count(*) AS orphan_installments
  FROM public.payment_installments pi
  JOIN public.extra_payment_requests epr ON epr.id = pi.extra_payment_request_id
 WHERE pi.source_type = 'extra_payment'
   AND epr.status = 'cancelado'
   AND pi.status <> 'cancelado';
-- Esperado: 0.

-- 7) Registro do reparo (PE-2608-0002). A numeração é POR CLIENTE: em PROD
--    existem duas PE-2608-0002 (Rio Log, cancelada; Deluna, aprovada).
--    Só a da Rio Log é alvo do reparo.
SELECT epr.request_number, epr.client_id, epr.status AS status_pedido,
       pi.status, pi.value, pi.cancelled_by, pi.cancellation_reason
  FROM public.payment_installments pi
  JOIN public.extra_payment_requests epr ON epr.id = pi.extra_payment_request_id
 WHERE epr.request_number = 'PE-2608-0002'
 ORDER BY epr.client_id;
-- Esperado em PROD: 2 linhas.
--   Rio Log (c3bb7c73-…): status_pedido 'cancelado', status 'cancelado',
--     value = 300.00, cancelled_by = NULL, motivo começando por 'Reparo 2026-09-11'.
--   Deluna (da9ad1ff-…): status_pedido 'aprovado', status 'aprovado',
--     value = 35.00 — intocada.
-- Esperado em DEV: 0 linhas.

-- 8) Informativo: distribuição de status após a migration.
SELECT 'payment_installments' AS tbl, status, count(*) AS total
  FROM public.payment_installments GROUP BY status
UNION ALL
SELECT 'extra_payment_requests', status, count(*)
  FROM public.extra_payment_requests GROUP BY status
 ORDER BY 1, 2;
