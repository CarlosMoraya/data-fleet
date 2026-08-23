-- ============================================================
-- DIAGNÓSTICO: check-audit-events-phase1
-- Data: 2026-08-24
-- Descrição: Conferência estrutural SOMENTE LEITURA da migration
--   20260824000000_audit_events_phase1.sql. Prova, por consulta, que os
--   25 objetos da Fase 1 da auditoria existem no ambiente:
--     4 tabelas, RLS habilitada nas 4, 4 policies (todas de SELECT e
--     nenhuma de INSERT/UPDATE/DELETE), 8 índices, 12 gatilhos e
--     6 funções, todas SECURITY DEFINER.
-- ⚠️ RODAR NO SUPABASE SQL EDITOR (DEV antes de PROD).
-- ⚠️ Este arquivo não contém nenhum DDL/DML — somente SELECT.
-- ⚠️ Todas as linhas devem retornar status = 'OK'.
-- ============================================================

-- ─── 0. Identificação de banco/host/data ───────────────────────

SELECT
  current_database()  AS database_name,
  inet_server_addr()  AS server_addr,
  inet_server_port()  AS server_port,
  NOW()               AS diagnostic_run_at,
  version()           AS postgres_version;

-- ─── 1. As 4 tabelas de eventos existem ────────────────────────

SELECT
  esperado.table_name,
  CASE WHEN t.table_name IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('maintenance_order_events'),
  ('payment_installment_events'),
  ('extra_payment_request_events'),
  ('profile_security_events')
) AS esperado(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = esperado.table_name
 AND t.table_type = 'BASE TABLE'
ORDER BY esperado.table_name;
-- Esperado: 4 linhas, todas com status = 'OK'.

-- ─── 2. RLS habilitada nas 4 tabelas ───────────────────────────

SELECT
  esperado.table_name,
  COALESCE(pt.rowsecurity, false) AS rowsecurity,
  CASE WHEN COALESCE(pt.rowsecurity, false) THEN 'OK' ELSE 'FALTANDO' END AS status
FROM (VALUES
  ('maintenance_order_events'),
  ('payment_installment_events'),
  ('extra_payment_request_events'),
  ('profile_security_events')
) AS esperado(table_name)
LEFT JOIN pg_tables pt
  ON pt.schemaname = 'public'
 AND pt.tablename = esperado.table_name
ORDER BY esperado.table_name;
-- Esperado: 4 linhas, rowsecurity = true e status = 'OK' em todas.

-- ─── 3.1 As 4 policies de SELECT existem ───────────────────────
-- polcmd: 'r' = SELECT, 'a' = INSERT, 'w' = UPDATE, 'd' = DELETE, '*' = ALL.

SELECT
  esperado.policy_name,
  esperado.table_name,
  CASE
    WHEN p.polname IS NULL THEN 'FALTANDO'
    WHEN p.polcmd <> 'r'   THEN 'FALTANDO'
    ELSE 'OK'
  END AS status
FROM (VALUES
  ('maintenance_order_events_select',     'maintenance_order_events'),
  ('payment_installment_events_select',   'payment_installment_events'),
  ('extra_payment_request_events_select', 'extra_payment_request_events'),
  ('profile_security_events_select',      'profile_security_events')
) AS esperado(policy_name, table_name)
LEFT JOIN pg_policy p
  ON p.polname = esperado.policy_name
 AND p.polrelid = to_regclass('public.' || esperado.table_name)
ORDER BY esperado.table_name;
-- Esperado: 4 linhas, todas com status = 'OK'.

-- ─── 3.2 Zero policies de INSERT/UPDATE/DELETE/ALL ─────────────

SELECT
  COUNT(*) FILTER (WHERE p.polcmd = 'r')  AS policies_select,
  COUNT(*) FILTER (WHERE p.polcmd <> 'r') AS policies_de_escrita,
  CASE
    WHEN COUNT(*) FILTER (WHERE p.polcmd = 'r') = 4
     AND COUNT(*) FILTER (WHERE p.polcmd <> 'r') = 0
    THEN 'OK' ELSE 'FALTANDO'
  END AS status
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'maintenance_order_events', 'payment_installment_events',
    'extra_payment_request_events', 'profile_security_events'
  );
-- Esperado: policies_select = 4, policies_de_escrita = 0, status = 'OK'.
-- Uma policy de escrita aqui é falha grave: a tabela deixaria de ser
-- append-only pela API.

-- ─── 4. Os 8 índices existem ───────────────────────────────────

SELECT
  esperado.index_name,
  CASE WHEN i.indexname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('idx_maintenance_order_events_order'),
  ('idx_maintenance_order_events_client'),
  ('idx_payment_installment_events_installment'),
  ('idx_payment_installment_events_client'),
  ('idx_extra_payment_request_events_request'),
  ('idx_extra_payment_request_events_client'),
  ('idx_profile_security_events_profile'),
  ('idx_profile_security_events_client')
) AS esperado(index_name)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = esperado.index_name
ORDER BY esperado.index_name;
-- Esperado: 8 linhas, todas com status = 'OK'.

-- ─── 5. Os 12 gatilhos existem ─────────────────────────────────
-- 8 de captura (2 por entidade) + 4 de imutabilidade.

SELECT
  esperado.trigger_name,
  esperado.table_name,
  CASE WHEN t.tgname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('trg_audit_maintenance_order_insert',        'maintenance_orders'),
  ('trg_audit_maintenance_order_status',        'maintenance_orders'),
  ('trg_audit_payment_installment_insert',      'payment_installments'),
  ('trg_audit_payment_installment_status',      'payment_installments'),
  ('trg_audit_extra_payment_request_insert',    'extra_payment_requests'),
  ('trg_audit_extra_payment_request_status',    'extra_payment_requests'),
  ('trg_audit_profile_security_insert',         'profiles'),
  ('trg_audit_profile_security_update',         'profiles'),
  ('trg_maintenance_order_events_immutable',    'maintenance_order_events'),
  ('trg_payment_installment_events_immutable',  'payment_installment_events'),
  ('trg_extra_payment_request_events_immutable','extra_payment_request_events'),
  ('trg_profile_security_events_immutable',     'profile_security_events')
) AS esperado(trigger_name, table_name)
LEFT JOIN pg_trigger t
  ON t.tgname = esperado.trigger_name
 AND t.tgrelid = to_regclass('public.' || esperado.table_name)
 AND NOT t.tgisinternal
ORDER BY esperado.table_name, esperado.trigger_name;
-- Esperado: 12 linhas, todas com status = 'OK'.

-- ─── 5.1 Definição dos gatilhos (conferência da cláusula WHEN) ──
-- Os 4 gatilhos de UPDATE têm de trazer "WHEN ((old.<campo> IS DISTINCT FROM
-- new.<campo>))"; os 4 de imutabilidade têm de ser BEFORE UPDATE e NUNCA
-- mencionar DELETE (cobrir DELETE quebraria a cascata do registro-pai).

SELECT
  c.relname AS table_name,
  t.tgname  AS trigger_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname IN (
    'trg_audit_maintenance_order_insert',        'trg_audit_maintenance_order_status',
    'trg_audit_payment_installment_insert',      'trg_audit_payment_installment_status',
    'trg_audit_extra_payment_request_insert',    'trg_audit_extra_payment_request_status',
    'trg_audit_profile_security_insert',         'trg_audit_profile_security_update',
    'trg_maintenance_order_events_immutable',    'trg_payment_installment_events_immutable',
    'trg_extra_payment_request_events_immutable','trg_profile_security_events_immutable'
  )
ORDER BY c.relname, t.tgname;
-- Esperado: 12 linhas. Nenhuma definição de gatilho de imutabilidade deve
-- conter a palavra DELETE.

-- ─── 6. As 6 funções existem ───────────────────────────────────
-- 1 de autoria (fn_audit_actor), 1 de imutabilidade compartilhada
-- (fn_audit_events_immutable) e 4 de captura (uma por entidade).

SELECT
  esperado.function_name,
  CASE WHEN p.proname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('fn_audit_actor'),
  ('fn_audit_events_immutable'),
  ('fn_audit_maintenance_order'),
  ('fn_audit_payment_installment'),
  ('fn_audit_extra_payment_request'),
  ('fn_audit_profile_security')
) AS esperado(function_name)
LEFT JOIN (
  SELECT pr.proname, pr.prosecdef
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public'
) p ON p.proname = esperado.function_name
ORDER BY esperado.function_name;
-- Esperado: 6 linhas, todas com status = 'OK'.

-- ─── 7. prosecdef = true nas 6 funções ─────────────────────────
-- Sem SECURITY DEFINER, a leitura de profiles dentro do gatilho fica sujeita
-- à RLS da própria profiles, pode devolver vazio, estourar o NOT NULL de
-- actor_name_snapshot e DERRUBAR a escrita de negócio.

SELECT
  esperado.function_name,
  p.prosecdef,
  CASE WHEN COALESCE(p.prosecdef, false) THEN 'OK' ELSE 'FALTANDO' END AS status
FROM (VALUES
  ('fn_audit_actor'),
  ('fn_audit_events_immutable'),
  ('fn_audit_maintenance_order'),
  ('fn_audit_payment_installment'),
  ('fn_audit_extra_payment_request'),
  ('fn_audit_profile_security')
) AS esperado(function_name)
LEFT JOIN (
  SELECT pr.proname, pr.prosecdef
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public'
) p ON p.proname = esperado.function_name
ORDER BY esperado.function_name;
-- Esperado: 6 linhas, prosecdef = true e status = 'OK' em todas.

-- ─── 8. Resumo geral (uma linha por grupo de objetos) ──────────

WITH tabelas AS (
  SELECT COUNT(*) AS n FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name IN (
      'maintenance_order_events', 'payment_installment_events',
      'extra_payment_request_events', 'profile_security_events')
), rls AS (
  SELECT COUNT(*) AS n FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity
    AND tablename IN (
      'maintenance_order_events', 'payment_installment_events',
      'extra_payment_request_events', 'profile_security_events')
), policies AS (
  SELECT
    COUNT(*) FILTER (WHERE p.polcmd = 'r')  AS n_select,
    COUNT(*) FILTER (WHERE p.polcmd <> 'r') AS n_escrita
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname IN (
      'maintenance_order_events', 'payment_installment_events',
      'extra_payment_request_events', 'profile_security_events')
), indices AS (
  SELECT COUNT(*) AS n FROM pg_indexes
  WHERE schemaname = 'public' AND indexname IN (
    'idx_maintenance_order_events_order',        'idx_maintenance_order_events_client',
    'idx_payment_installment_events_installment','idx_payment_installment_events_client',
    'idx_extra_payment_request_events_request',  'idx_extra_payment_request_events_client',
    'idx_profile_security_events_profile',       'idx_profile_security_events_client')
), gatilhos AS (
  SELECT COUNT(*) AS n FROM pg_trigger t
  WHERE NOT t.tgisinternal AND t.tgname IN (
    'trg_audit_maintenance_order_insert',        'trg_audit_maintenance_order_status',
    'trg_audit_payment_installment_insert',      'trg_audit_payment_installment_status',
    'trg_audit_extra_payment_request_insert',    'trg_audit_extra_payment_request_status',
    'trg_audit_profile_security_insert',         'trg_audit_profile_security_update',
    'trg_maintenance_order_events_immutable',    'trg_payment_installment_events_immutable',
    'trg_extra_payment_request_events_immutable','trg_profile_security_events_immutable')
), funcoes AS (
  SELECT
    COUNT(*) AS n,
    COUNT(*) FILTER (WHERE pr.prosecdef) AS n_secdef
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public' AND pr.proname IN (
    'fn_audit_actor',               'fn_audit_events_immutable',
    'fn_audit_maintenance_order',   'fn_audit_payment_installment',
    'fn_audit_extra_payment_request','fn_audit_profile_security')
)
SELECT 'tabelas'              AS objeto, tabelas.n::text  AS encontrado, '4' AS esperado,
       CASE WHEN tabelas.n  = 4 THEN 'OK' ELSE 'FALTANDO' END AS status FROM tabelas
UNION ALL
SELECT 'rls_habilitada',      rls.n::text,      '4', CASE WHEN rls.n      = 4 THEN 'OK' ELSE 'FALTANDO' END FROM rls
UNION ALL
SELECT 'policies_select',     policies.n_select::text,  '4', CASE WHEN policies.n_select  = 4 THEN 'OK' ELSE 'FALTANDO' END FROM policies
UNION ALL
SELECT 'policies_de_escrita', policies.n_escrita::text, '0', CASE WHEN policies.n_escrita = 0 THEN 'OK' ELSE 'FALTANDO' END FROM policies
UNION ALL
SELECT 'indices',             indices.n::text,  '8',  CASE WHEN indices.n  = 8  THEN 'OK' ELSE 'FALTANDO' END FROM indices
UNION ALL
SELECT 'gatilhos',            gatilhos.n::text, '12', CASE WHEN gatilhos.n = 12 THEN 'OK' ELSE 'FALTANDO' END FROM gatilhos
UNION ALL
SELECT 'funcoes',             funcoes.n::text,  '6',  CASE WHEN funcoes.n  = 6  THEN 'OK' ELSE 'FALTANDO' END FROM funcoes
UNION ALL
SELECT 'funcoes_security_definer', funcoes.n_secdef::text, '6', CASE WHEN funcoes.n_secdef = 6 THEN 'OK' ELSE 'FALTANDO' END FROM funcoes;
-- Esperado: 8 linhas, todas com status = 'OK'.
