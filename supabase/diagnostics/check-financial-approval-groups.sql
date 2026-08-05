-- ============================================================
-- DIAGNÓSTICO: check-financial-approval-groups
-- Data: 2026-08-04
-- Descrição: Diagnóstico SOMENTE LEITURA do estado real de
--   payment_installments / extra_payment_requests e dos objetos
--   de banco relacionados, para provar o estado antes/depois da
--   migration 20260804000000_secure_financial_approval_groups.sql.
-- ⚠️ RODAR NO SUPABASE SQL EDITOR (DEV antes de PROD).
-- ⚠️ Este arquivo não contém nenhum DDL/DML — somente SELECT.
-- ============================================================

-- ─── 0. Identificação de banco/host/data ───────────────────────

SELECT
  current_database()  AS database_name,
  inet_server_addr()  AS server_addr,
  inet_server_port()  AS server_port,
  NOW()                AS diagnostic_run_at,
  version()            AS postgres_version;

-- ─── 1. Definição atual das funções de transição ───────────────

SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_validate_payment_installment_transition',
    'fn_validate_extra_payment_request_transition',
    'fn_enforce_payment_installment_budget_cap',
    'fn_validate_payment_installment_source_integrity',
    'fn_sync_extra_payment_request_installments',
    'fn_sync_extra_payment_request_paid_status',
    'approve_maintenance_payment_group',
    'approve_extra_payment_request_group'
  )
ORDER BY p.proname;

-- ─── 2. Triggers atuais em payment_installments e extra_payment_requests ───

SELECT
  c.relname AS table_name,
  t.tgname  AS trigger_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('payment_installments', 'extra_payment_requests')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ─── 3. Policies (RLS) atuais das duas tabelas ─────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('payment_installments', 'extra_payment_requests')
ORDER BY tablename, policyname;

-- ─── 4. Privilégios das novas RPCs (quando existirem) ──────────

SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('approve_maintenance_payment_group', 'approve_extra_payment_request_group')
ORDER BY routine_name, grantee;

-- ─── 5. Parcelas cujo client_id diverge da OS/pedido de origem ─

SELECT COUNT(*) AS installments_with_client_id_mismatch
FROM public.payment_installments pi
LEFT JOIN public.maintenance_orders mo ON mo.id = pi.maintenance_order_id
LEFT JOIN public.extra_payment_requests epr ON epr.id = pi.extra_payment_request_id
WHERE
  (pi.source_type = 'maintenance_order' AND mo.id IS NOT NULL AND mo.client_id <> pi.client_id)
  OR
  (pi.source_type = 'extra_payment' AND epr.id IS NOT NULL AND epr.client_id <> pi.client_id);

-- ─── 6. Extras pendentes sem nenhuma parcela ────────────────────

SELECT COUNT(*) AS pending_extra_requests_without_installments
FROM public.extra_payment_requests epr
WHERE epr.status = 'pendente_aprovacao'
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_installments pi
    WHERE pi.extra_payment_request_id = epr.id
  );

-- ─── 7. Extras cujo amount diverge da soma das parcelas ─────────

SELECT COUNT(*) AS extra_requests_with_amount_mismatch
FROM public.extra_payment_requests epr
JOIN (
  SELECT extra_payment_request_id, SUM(value) AS installments_sum
  FROM public.payment_installments
  WHERE source_type = 'extra_payment'
  GROUP BY extra_payment_request_id
) totals ON totals.extra_payment_request_id = epr.id
WHERE totals.installments_sum <> epr.amount;

-- ─── 8. Cabeçalhos/parcelas com status contraditórios ───────────

-- 8a. Cabeçalho aprovado/reprovado com parcelas ainda pendentes.
SELECT COUNT(*) AS approved_or_rejected_headers_with_pending_installments
FROM public.extra_payment_requests epr
WHERE epr.status IN ('aprovado', 'reprovado')
  AND EXISTS (
    SELECT 1 FROM public.payment_installments pi
    WHERE pi.extra_payment_request_id = epr.id
      AND pi.status = 'pendente_aprovacao'
  );

-- 8b. Cabeçalho pendente com alguma parcela já aprovada/reprovada/paga.
SELECT COUNT(*) AS pending_headers_with_processed_installments
FROM public.extra_payment_requests epr
WHERE epr.status = 'pendente_aprovacao'
  AND EXISTS (
    SELECT 1 FROM public.payment_installments pi
    WHERE pi.extra_payment_request_id = epr.id
      AND pi.status <> 'pendente_aprovacao'
  );

-- 8c. Cabeçalho pago com alguma parcela diferente de paga.
SELECT COUNT(*) AS paid_headers_with_non_paid_installments
FROM public.extra_payment_requests epr
WHERE epr.status = 'pago'
  AND EXISTS (
    SELECT 1 FROM public.payment_installments pi
    WHERE pi.extra_payment_request_id = epr.id
      AND pi.status <> 'pago'
  );

-- ─── 9. Inventário das colunas discount e budget_discount ───────

SELECT
  table_name,
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'maintenance_budget_items' AND column_name = 'discount')
    OR (table_name = 'maintenance_orders' AND column_name = 'budget_discount')
  )
ORDER BY table_name, column_name;
