-- ============================================================
-- DIAGNÓSTICO: check-audit-events-phase2
-- Data: 2026-08-25
-- Descrição: Conferência estrutural SOMENTE LEITURA da migration
--   20260825000000_audit_events_phase2.sql. Prova, por consulta, que os
--   21 objetos da Fase 2 da auditoria existem no ambiente:
--     3 tabelas, RLS habilitada nas 3, 3 policies (todas de SELECT e
--     nenhuma de INSERT/UPDATE/DELETE), 6 índices, 6 gatilhos e
--     3 funções de captura, todas SECURITY DEFINER.
--   Confere também o pré-requisito da Fase 1 (fn_audit_actor e
--   fn_audit_events_immutable) e a observação aberta do MEMORY.md sobre
--   perfis com name nulo.
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

-- ─── 1. As 3 tabelas de eventos existem ────────────────────────

SELECT
  esperado.table_name,
  CASE WHEN t.table_name IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('vehicle_events'),
  ('driver_events'),
  ('workshop_schedule_events')
) AS esperado(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = esperado.table_name
 AND t.table_type = 'BASE TABLE'
ORDER BY esperado.table_name;
-- Esperado: 3 linhas, todas com status = 'OK'.

-- ─── 2. RLS habilitada nas 3 tabelas ───────────────────────────

SELECT
  esperado.table_name,
  COALESCE(pt.rowsecurity, false) AS rowsecurity,
  CASE WHEN COALESCE(pt.rowsecurity, false) THEN 'OK' ELSE 'FALTANDO' END AS status
FROM (VALUES
  ('vehicle_events'),
  ('driver_events'),
  ('workshop_schedule_events')
) AS esperado(table_name)
LEFT JOIN pg_tables pt
  ON pt.schemaname = 'public'
 AND pt.tablename = esperado.table_name
ORDER BY esperado.table_name;
-- Esperado: 3 linhas, rowsecurity = true e status = 'OK' em todas.

-- ─── 3. As 3 policies de SELECT existem ────────────────────────
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
  ('vehicle_events_select',           'vehicle_events'),
  ('driver_events_select',            'driver_events'),
  ('workshop_schedule_events_select', 'workshop_schedule_events')
) AS esperado(policy_name, table_name)
LEFT JOIN pg_policy p
  ON p.polname = esperado.policy_name
 AND p.polrelid = to_regclass('public.' || esperado.table_name)
ORDER BY esperado.table_name;
-- Esperado: 3 linhas, todas com status = 'OK'.

-- ─── 4. Zero policies de INSERT/UPDATE/DELETE/ALL ──────────────
-- Esta é a consulta que prova o append-only pela API: com RLS habilitada, a
-- ausência de policy de escrita já é negação. Uma policy de escrita aqui é
-- falha grave — a tabela deixaria de ser append-only.

SELECT
  COUNT(*) FILTER (WHERE p.polcmd = 'r')  AS policies_select,
  COUNT(*) FILTER (WHERE p.polcmd <> 'r') AS policies_de_escrita,
  CASE
    WHEN COUNT(*) FILTER (WHERE p.polcmd = 'r') = 3
     AND COUNT(*) FILTER (WHERE p.polcmd <> 'r') = 0
    THEN 'OK' ELSE 'FALTANDO'
  END AS status
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('vehicle_events', 'driver_events', 'workshop_schedule_events');
-- Esperado: policies_select = 3, policies_de_escrita = 0, status = 'OK'.

-- ─── 5. Os 6 índices existem ───────────────────────────────────

SELECT
  esperado.index_name,
  CASE WHEN i.indexname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('idx_vehicle_events_vehicle'),
  ('idx_vehicle_events_client'),
  ('idx_driver_events_driver'),
  ('idx_driver_events_client'),
  ('idx_workshop_schedule_events_schedule'),
  ('idx_workshop_schedule_events_client')
) AS esperado(index_name)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = esperado.index_name
ORDER BY esperado.index_name;
-- Esperado: 6 linhas, todas com status = 'OK'.

-- ─── 6. Os 6 gatilhos existem ──────────────────────────────────
-- 3 de captura (um por entidade) + 3 de imutabilidade.

SELECT
  esperado.trigger_name,
  esperado.table_name,
  CASE WHEN t.tgname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('trg_audit_vehicle_update',              'vehicles'),
  ('trg_audit_driver_update',               'drivers'),
  ('trg_audit_workshop_schedule_update',    'workshop_schedules'),
  ('trg_vehicle_events_immutable',          'vehicle_events'),
  ('trg_driver_events_immutable',           'driver_events'),
  ('trg_workshop_schedule_events_immutable','workshop_schedule_events')
) AS esperado(trigger_name, table_name)
LEFT JOIN pg_trigger t
  ON t.tgname = esperado.trigger_name
 AND t.tgrelid = to_regclass('public.' || esperado.table_name)
 AND NOT t.tgisinternal
ORDER BY esperado.table_name, esperado.trigger_name;
-- Esperado: 6 linhas, todas com status = 'OK'.

-- ─── 6.1 Definição dos gatilhos (conferência da cláusula WHEN) ──
-- Os 3 gatilhos de captura têm de trazer "WHEN ((old.<campo> IS DISTINCT FROM
-- new.<campo>) ...)"; os 3 de imutabilidade têm de ser BEFORE UPDATE e NUNCA
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
    'trg_audit_vehicle_update',              'trg_audit_driver_update',
    'trg_audit_workshop_schedule_update',
    'trg_vehicle_events_immutable',          'trg_driver_events_immutable',
    'trg_workshop_schedule_events_immutable'
  )
ORDER BY c.relname, t.tgname;
-- Esperado: 6 linhas. Nenhuma definição de gatilho de imutabilidade deve
-- conter a palavra DELETE.

-- ─── 7. As 3 funções de captura existem e são SECURITY DEFINER ──
-- Sem SECURITY DEFINER, a leitura de profiles dentro do gatilho fica sujeita
-- à RLS da própria profiles, pode devolver vazio, estourar o NOT NULL de
-- actor_name_snapshot e DERRUBAR a escrita de negócio.

SELECT
  esperado.function_name,
  p.prosecdef,
  CASE WHEN COALESCE(p.prosecdef, false) THEN 'OK' ELSE 'FALTANDO' END AS status
FROM (VALUES
  ('fn_audit_vehicle'),
  ('fn_audit_driver'),
  ('fn_audit_workshop_schedule')
) AS esperado(function_name)
LEFT JOIN (
  SELECT pr.proname, pr.prosecdef
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public'
) p ON p.proname = esperado.function_name
ORDER BY esperado.function_name;
-- Esperado: 3 linhas, prosecdef = true e status = 'OK' em todas.

-- ─── 8. Pré-requisito da Fase 1 presente ───────────────────────
-- Sem estas duas funções, os gatilhos desta fase falham em tempo de execução.
-- Elas NÃO são criadas por esta migration: pertencem a
-- 20260824000000_audit_events_phase1.sql, já em DEV e PROD.

SELECT
  esperado.function_name,
  CASE WHEN p.proname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('fn_audit_actor'),
  ('fn_audit_events_immutable')
) AS esperado(function_name)
LEFT JOIN (
  SELECT pr.proname
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public'
) p ON p.proname = esperado.function_name
ORDER BY esperado.function_name;
-- Esperado: 2 linhas, ambas com status = 'OK'.

-- ─── 9. Perfis sem nome (observação aberta do MEMORY.md) ───────
-- fn_audit_actor() grava profiles.name sem COALESCE. Um nome nulo violaria o
-- NOT NULL de actor_name_snapshot e DERRUBARIA a gravação de negócio — que,
-- com esta fase, passa a incluir edição de veículo e de motorista.
-- Se retornar diferente de zero: PARAR e reportar. NÃO alterar
-- fn_audit_actor(), que pertence à Fase 1 e está em produção.

SELECT
  count(*) AS perfis_sem_nome,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ATENCAO' END AS status
FROM public.profiles
WHERE name IS NULL;
-- Esperado: perfis_sem_nome = 0, status = 'OK'.

-- ─── 10. Resumo geral (uma linha por grupo de objetos) ─────────

WITH tabelas AS (
  SELECT COUNT(*) AS n FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name IN ('vehicle_events', 'driver_events', 'workshop_schedule_events')
), rls AS (
  SELECT COUNT(*) AS n FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity
    AND tablename IN ('vehicle_events', 'driver_events', 'workshop_schedule_events')
), policies AS (
  SELECT
    COUNT(*) FILTER (WHERE p.polcmd = 'r')  AS n_select,
    COUNT(*) FILTER (WHERE p.polcmd <> 'r') AS n_escrita
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname IN ('vehicle_events', 'driver_events', 'workshop_schedule_events')
), indices AS (
  SELECT COUNT(*) AS n FROM pg_indexes
  WHERE schemaname = 'public' AND indexname IN (
    'idx_vehicle_events_vehicle',            'idx_vehicle_events_client',
    'idx_driver_events_driver',              'idx_driver_events_client',
    'idx_workshop_schedule_events_schedule', 'idx_workshop_schedule_events_client')
), gatilhos AS (
  SELECT COUNT(*) AS n FROM pg_trigger t
  WHERE NOT t.tgisinternal AND t.tgname IN (
    'trg_audit_vehicle_update',              'trg_audit_driver_update',
    'trg_audit_workshop_schedule_update',
    'trg_vehicle_events_immutable',          'trg_driver_events_immutable',
    'trg_workshop_schedule_events_immutable')
), funcoes AS (
  SELECT
    COUNT(*) AS n,
    COUNT(*) FILTER (WHERE pr.prosecdef) AS n_secdef
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public' AND pr.proname IN (
    'fn_audit_vehicle', 'fn_audit_driver', 'fn_audit_workshop_schedule')
), fase1 AS (
  SELECT COUNT(*) AS n
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public' AND pr.proname IN (
    'fn_audit_actor', 'fn_audit_events_immutable')
), perfis AS (
  SELECT COUNT(*) AS n FROM public.profiles WHERE name IS NULL
)
SELECT 'tabelas'              AS objeto, tabelas.n::text AS encontrado, '3' AS esperado,
       CASE WHEN tabelas.n = 3 THEN 'OK' ELSE 'FALTANDO' END AS status FROM tabelas
UNION ALL
SELECT 'rls_habilitada',      rls.n::text,      '3', CASE WHEN rls.n      = 3 THEN 'OK' ELSE 'FALTANDO' END FROM rls
UNION ALL
SELECT 'policies_select',     policies.n_select::text,  '3', CASE WHEN policies.n_select  = 3 THEN 'OK' ELSE 'FALTANDO' END FROM policies
UNION ALL
SELECT 'policies_de_escrita', policies.n_escrita::text, '0', CASE WHEN policies.n_escrita = 0 THEN 'OK' ELSE 'FALTANDO' END FROM policies
UNION ALL
SELECT 'indices',             indices.n::text,  '6', CASE WHEN indices.n  = 6 THEN 'OK' ELSE 'FALTANDO' END FROM indices
UNION ALL
SELECT 'gatilhos',            gatilhos.n::text, '6', CASE WHEN gatilhos.n = 6 THEN 'OK' ELSE 'FALTANDO' END FROM gatilhos
UNION ALL
SELECT 'funcoes_captura',     funcoes.n::text,  '3', CASE WHEN funcoes.n  = 3 THEN 'OK' ELSE 'FALTANDO' END FROM funcoes
UNION ALL
SELECT 'funcoes_security_definer', funcoes.n_secdef::text, '3', CASE WHEN funcoes.n_secdef = 3 THEN 'OK' ELSE 'FALTANDO' END FROM funcoes
UNION ALL
SELECT 'funcoes_fase1_presentes',  fase1.n::text, '2', CASE WHEN fase1.n = 2 THEN 'OK' ELSE 'FALTANDO' END FROM fase1
UNION ALL
SELECT 'perfis_sem_nome',          perfis.n::text, '0', CASE WHEN perfis.n = 0 THEN 'OK' ELSE 'ATENCAO' END FROM perfis;
-- Esperado: 10 linhas, todas com status = 'OK'.
