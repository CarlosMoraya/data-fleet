-- ============================================================
-- DIAGNÓSTICO: trava de status no INSERT de payment_installments
-- Data: 2026-09-12 — acompanha
--       20260912000000_harden_payment_installment_insert.sql
-- SOMENTE LEITURA. Rodar em DEV e em PROD após aplicar a migration.
--
-- LIMITAÇÃO: este arquivo verifica ESTRUTURA. Não tente testar a
-- policy com INSERT aqui: o SQL Editor roda como service_role, que
-- não passa por RLS, e o teste passaria sempre. Comportamento é
-- validado pela spec E2E, que autentica como usuário real:
--   PLAYWRIGHT_INCLUDE_PENDING=1 npx playwright test \
--     e2e/pending/payment-installment-insert-status.spec.ts --project=chromium
-- ============================================================

-- 1) A policy existe, é de INSERT e vale para authenticated.
SELECT pol.polname,
       pol.polcmd,
       (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid = ANY(pol.polroles)) AS roles
  FROM pg_policy pol
 WHERE pol.polrelid = 'public.payment_installments'::regclass
   AND pol.polname = 'payment_installments_insert';
-- Esperado: 1 linha, polcmd = 'a', roles = {authenticated}.

-- 2) As oito cláusulas novas entraram, e as regras antigas continuam lá.
SELECT
  position('status = ''pendente_aprovacao''' IN expr) > 0        AS has_status_lock,
  position('payment_approved_by IS NULL' IN expr) > 0            AS has_approved_by_lock,
  position('payment_approved_at IS NULL' IN expr) > 0            AS has_approved_at_lock,
  position('paid_by IS NULL' IN expr) > 0                        AS has_paid_by_lock,
  position('paid_at IS NULL' IN expr) > 0                        AS has_paid_at_lock,
  position('cancelled_by IS NULL' IN expr) > 0                   AS has_cancelled_by_lock,
  position('cancelled_at IS NULL' IN expr) > 0                   AS has_cancelled_at_lock,
  position('cancellation_reason IS NULL' IN expr) > 0            AS has_reason_lock,
  position('created_by_id = auth.uid()' IN expr) > 0             AS keeps_author_check,
  position('''maintenance_order''' IN expr) > 0                  AS keeps_maintenance_branch,
  position('''extra_payment''' IN expr) > 0                      AS keeps_extra_branch,
  position('''Admin Master''' IN expr) > 0                       AS keeps_admin_master,
  position('''Workshop''' IN expr) > 0                           AS keeps_workshop_branch,
  position('role_rank' IN expr) > 0                              AS keeps_role_rank,
  position('client_id' IN expr) > 0                              AS keeps_tenant_check
  FROM (
    SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) AS expr
      FROM pg_policy pol
     WHERE pol.polrelid = 'public.payment_installments'::regclass
       AND pol.polname = 'payment_installments_insert'
  ) s;
-- Esperado: 1 linha com TODAS as 15 colunas = t.
-- Qualquer 'keeps_*' em f significa que a policy foi recriada
-- incompleta — REVERTER e reaplicar antes de seguir.

-- 3) Nenhum gatilho novo foi criado (a correção é por policy, não por gatilho).
SELECT count(*) AS gatilhos_before_insert
  FROM pg_trigger t
 WHERE t.tgrelid = 'public.payment_installments'::regclass
   AND NOT t.tgisinternal
   AND (t.tgtype & 2) = 2
   AND (t.tgtype & 4) = 4;
-- Esperado: 3 (budget_cap, source_payable, source_integrity). Se vier 4,
-- alguém acrescentou um gatilho contra a restrição absoluta do plano.

-- 4) Controle histórico: nenhuma parcela nasceu fora do pendente.
SELECT count(*) FILTER (WHERE new_value->>'status' IS DISTINCT FROM 'pendente_aprovacao')
         AS criadas_fora_do_pendente,
       count(*) AS total_eventos_created
  FROM public.payment_installment_events
 WHERE event_type = 'created';
-- Esperado: criadas_fora_do_pendente = 0.
-- Medido em 2026-09-11: 0 de 53 em PROD.
