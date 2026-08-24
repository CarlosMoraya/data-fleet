-- ============================================================
-- DIAGNÓSTICO: check-audit-events-phase3
-- Data: 2026-08-26
-- Descrição: Conferência estrutural SOMENTE LEITURA da migration
--   20260826000000_audit_events_phase3.sql. Prova, por consulta, que os
--   32 objetos da Fase 3 da auditoria existem no ambiente:
--     4 tabelas, RLS habilitada nas 4, 4 policies (todas de SELECT e
--     nenhuma de INSERT/UPDATE/DELETE), 7 índices, 12 gatilhos e
--     5 funções — a auxiliar fn_audit_jsonb_diff e as 4 de captura,
--     todas SECURITY DEFINER e com search_path fixado.
--   Confere também o pré-requisito da Fase 1 (fn_audit_actor e
--   fn_audit_events_immutable), os CHECKs de event_type, a variação de
--   contrato de client_events (7 colunas, sem coluna extra de entidade) e
--   a observação aberta do MEMORY.md sobre perfis com name nulo.
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
  ('tire_events'),
  ('shipper_events'),
  ('operational_unit_events'),
  ('client_events')
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
  ('tire_events'),
  ('shipper_events'),
  ('operational_unit_events'),
  ('client_events')
) AS esperado(table_name)
LEFT JOIN pg_tables pt
  ON pt.schemaname = 'public'
 AND pt.tablename = esperado.table_name
ORDER BY esperado.table_name;
-- Esperado: 4 linhas, rowsecurity = true e status = 'OK' em todas.

-- ─── 3. As 4 policies de SELECT existem ────────────────────────
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
  ('tire_events_select',             'tire_events'),
  ('shipper_events_select',          'shipper_events'),
  ('operational_unit_events_select', 'operational_unit_events'),
  ('client_events_select',           'client_events')
) AS esperado(policy_name, table_name)
LEFT JOIN pg_policy p
  ON p.polname = esperado.policy_name
 AND p.polrelid = to_regclass('public.' || esperado.table_name)
ORDER BY esperado.table_name;
-- Esperado: 4 linhas, todas com status = 'OK'.

-- ─── 3.1 Zero policies de INSERT/UPDATE/DELETE/ALL ─────────────
-- Esta é a consulta que prova o append-only pela API: com RLS habilitada, a
-- ausência de policy de escrita já é negação. Uma policy de escrita aqui é
-- falha grave — a tabela deixaria de ser append-only.

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
    'tire_events', 'shipper_events',
    'operational_unit_events', 'client_events'
  );
-- Esperado: policies_select = 4, policies_de_escrita = 0, status = 'OK'.

-- ─── 4. Os 7 índices existem ───────────────────────────────────
-- São 7, e não 8: client_events tem um único índice, porque client_id acumula
-- os dois papéis do contrato e os dois índices padrão colapsariam na mesma
-- definição.

SELECT
  esperado.index_name,
  CASE WHEN i.indexname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('idx_tire_events_tire'),
  ('idx_tire_events_client'),
  ('idx_shipper_events_shipper'),
  ('idx_shipper_events_client'),
  ('idx_operational_unit_events_unit'),
  ('idx_operational_unit_events_client'),
  ('idx_client_events_client')
) AS esperado(index_name)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = esperado.index_name
ORDER BY esperado.index_name;
-- Esperado: 7 linhas, todas com status = 'OK'.

-- ─── 5. Os 12 gatilhos existem ─────────────────────────────────
-- 8 de captura (INSERT e UPDATE por entidade) + 4 de imutabilidade.

SELECT
  esperado.trigger_name,
  esperado.table_name,
  CASE WHEN t.tgname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('trg_audit_tire_insert',                 'tires'),
  ('trg_audit_tire_update',                 'tires'),
  ('trg_audit_shipper_insert',              'shippers'),
  ('trg_audit_shipper_update',              'shippers'),
  ('trg_audit_operational_unit_insert',     'operational_units'),
  ('trg_audit_operational_unit_update',     'operational_units'),
  ('trg_audit_client_insert',               'clients'),
  ('trg_audit_client_update',               'clients'),
  ('trg_tire_events_immutable',             'tire_events'),
  ('trg_shipper_events_immutable',          'shipper_events'),
  ('trg_operational_unit_events_immutable', 'operational_unit_events'),
  ('trg_client_events_immutable',           'client_events')
) AS esperado(trigger_name, table_name)
LEFT JOIN pg_trigger t
  ON t.tgname = esperado.trigger_name
 AND t.tgrelid = to_regclass('public.' || esperado.table_name)
 AND NOT t.tgisinternal
ORDER BY esperado.table_name, esperado.trigger_name;
-- Esperado: 12 linhas, todas com status = 'OK'.

-- ─── 5.1 Definição dos gatilhos (conferência visual) ───────────
-- Os 4 gatilhos de UPDATE NÃO têm cláusula WHEN — desvio deliberado das Fases
-- 1 e 2, documentado na SEÇÃO 2 da migration: a guarda de diff vazio vive
-- dentro da função, num único ponto de manutenção. NÃO "corrigir".
-- Os 4 de imutabilidade têm de ser BEFORE UPDATE e NUNCA mencionar DELETE
-- (cobrir DELETE quebraria a cascata do registro-pai).

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
    'trg_audit_tire_insert',                 'trg_audit_tire_update',
    'trg_audit_shipper_insert',              'trg_audit_shipper_update',
    'trg_audit_operational_unit_insert',     'trg_audit_operational_unit_update',
    'trg_audit_client_insert',               'trg_audit_client_update',
    'trg_tire_events_immutable',             'trg_shipper_events_immutable',
    'trg_operational_unit_events_immutable', 'trg_client_events_immutable'
  )
ORDER BY c.relname, t.tgname;
-- Esperado: 12 linhas. Nenhuma definição de gatilho de imutabilidade deve
-- conter a palavra DELETE.

-- ─── 6. As 5 funções existem ───────────────────────────────────
-- fn_audit_jsonb_diff é a auxiliar compartilhada (nasce nesta fase); as
-- outras quatro são as funções de captura, uma por entidade.

SELECT
  esperado.function_name,
  CASE WHEN p.proname IS NULL THEN 'FALTANDO' ELSE 'OK' END AS status
FROM (VALUES
  ('fn_audit_jsonb_diff'),
  ('fn_audit_tire'),
  ('fn_audit_shipper'),
  ('fn_audit_operational_unit'),
  ('fn_audit_client')
) AS esperado(function_name)
LEFT JOIN (
  SELECT pr.proname
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public'
) p ON p.proname = esperado.function_name
ORDER BY esperado.function_name;
-- Esperado: 5 linhas, todas com status = 'OK'.

-- ─── 7. As 4 funções de captura: SECURITY DEFINER + search_path ─
-- SECURITY DEFINER é obrigatório: a função insere numa tabela que não tem
-- policy de INSERT; sem ele a escrita de auditoria seria negada pela RLS e
-- derrubaria a operação de negócio. O search_path fixado impede sequestro de
-- resolução de nomes — o vetor clássico de escalação via SECURITY DEFINER.
--
-- fn_audit_jsonb_diff NÃO aparece aqui de propósito: não lê tabela alguma,
-- então não é SECURITY DEFINER (menor privilégio). Seu search_path é conferido
-- à parte, logo abaixo.

SELECT
  esperado.function_name,
  p.prosecdef,
  p.proconfig,
  CASE
    WHEN p.proname IS NULL THEN 'FALTANDO'
    WHEN NOT p.prosecdef THEN 'FALTANDO'
    WHEN p.proconfig IS NULL THEN 'FALTANDO'
    WHEN NOT (p.proconfig::text LIKE '%search_path=public%') THEN 'FALTANDO'
    ELSE 'OK'
  END AS status
FROM (VALUES
  ('fn_audit_tire'),
  ('fn_audit_shipper'),
  ('fn_audit_operational_unit'),
  ('fn_audit_client')
) AS esperado(function_name)
LEFT JOIN (
  SELECT pr.proname, pr.prosecdef, pr.proconfig
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public'
) p ON p.proname = esperado.function_name
ORDER BY esperado.function_name;
-- Esperado: 4 linhas, prosecdef = true, proconfig contendo search_path=public
-- e status = 'OK' em todas.

-- ─── 7.1 fn_audit_jsonb_diff: NÃO SECURITY DEFINER ─────────────

SELECT
  pr.proname AS function_name,
  pr.prosecdef,
  pr.proconfig,
  CASE
    WHEN NOT pr.prosecdef
     AND pr.proconfig IS NOT NULL
     AND pr.proconfig::text LIKE '%search_path=public%'
    THEN 'OK' ELSE 'FALTANDO'
  END AS status
FROM pg_proc pr
JOIN pg_namespace ns ON ns.oid = pr.pronamespace
WHERE ns.nspname = 'public'
  AND pr.proname = 'fn_audit_jsonb_diff';
-- Esperado: 1 linha, prosecdef = false, search_path fixado, status = 'OK'.

-- ─── 8. CHECKs de event_type aceitam 'created' e 'updated' ─────
-- A Fase 3 NÃO inclui o evento 'deleted': o rastro de exclusão foi adiado para
-- uma Fase 4 dedicada, cobrindo de uma vez todas as entidades das Fases 1, 2
-- e 3. Um CHECK com 'deleted' aqui indica que alguém saiu do escopo.

SELECT
  esperado.table_name,
  con.conname,
  pg_get_constraintdef(con.oid) AS definition,
  CASE
    WHEN con.conname IS NULL THEN 'FALTANDO'
    WHEN pg_get_constraintdef(con.oid) LIKE '%''created''%'
     AND pg_get_constraintdef(con.oid) LIKE '%''updated''%'
     AND pg_get_constraintdef(con.oid) NOT LIKE '%''deleted''%'
    THEN 'OK' ELSE 'FALTANDO'
  END AS status
FROM (VALUES
  ('tire_events'),
  ('shipper_events'),
  ('operational_unit_events'),
  ('client_events')
) AS esperado(table_name)
LEFT JOIN pg_constraint con
  ON con.conrelid = to_regclass('public.' || esperado.table_name)
 AND con.contype = 'c'
 AND pg_get_constraintdef(con.oid) LIKE '%event_type%'
ORDER BY esperado.table_name;
-- Esperado: 4 linhas, todas com status = 'OK'.

-- ─── 9. Pré-requisito da Fase 1 presente ───────────────────────
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

-- ─── 10. client_events tem 7 colunas, sem coluna extra ─────────
-- GUARDA CONTRA "CONSERTO" DA VARIAÇÃO DE CONTRATO DA SEÇÃO 5: clients é o
-- próprio tenant, então client_id acumula os dois papéis (isolamento de RLS e
-- identificação da linha auditada). Uma coluna client_events.client_event_id
-- ou similar significa que alguém duplicou o mesmo UUID em duas colunas.

SELECT
  count(*) AS colunas,
  count(*) FILTER (
    WHERE column_name NOT IN (
      'id', 'client_id', 'event_type', 'old_value',
      'new_value', 'actor_id', 'actor_name_snapshot', 'occurred_at'
    )
  ) AS colunas_inesperadas,
  CASE
    WHEN count(*) = 7
     AND count(*) FILTER (
       WHERE column_name NOT IN (
         'id', 'client_id', 'event_type', 'old_value',
         'new_value', 'actor_id', 'actor_name_snapshot', 'occurred_at'
       )
     ) = 0
    THEN 'OK' ELSE 'FALTANDO'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_events';
-- Esperado: colunas = 7, colunas_inesperadas = 0, status = 'OK'.

-- ─── 11. Perfis sem nome (observação aberta do MEMORY.md) ──────
-- fn_audit_actor() grava profiles.name sem COALESCE. Um nome nulo violaria o
-- NOT NULL de actor_name_snapshot e DERRUBARIA a gravação de negócio — que,
-- com esta fase, passa a incluir a criação de pneus, embarcadores, unidades
-- operacionais e CLIENTES (ou seja, de tenants novos).
-- Se retornar diferente de zero: PARAR e reportar. NÃO alterar
-- fn_audit_actor(), que pertence à Fase 1 e está em produção.

SELECT
  count(*) AS perfis_sem_nome,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ATENCAO' END AS status
FROM public.profiles
WHERE name IS NULL;
-- Esperado: perfis_sem_nome = 0, status = 'OK'.

-- ─── 12. Resumo geral (uma linha por grupo de objetos) ─────────

WITH tabelas AS (
  SELECT COUNT(*) AS n FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name IN (
      'tire_events', 'shipper_events',
      'operational_unit_events', 'client_events')
), rls AS (
  SELECT COUNT(*) AS n FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity
    AND tablename IN (
      'tire_events', 'shipper_events',
      'operational_unit_events', 'client_events')
), policies AS (
  SELECT
    COUNT(*) FILTER (WHERE p.polcmd = 'r')  AS n_select,
    COUNT(*) FILTER (WHERE p.polcmd <> 'r') AS n_escrita
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname IN (
      'tire_events', 'shipper_events',
      'operational_unit_events', 'client_events')
), indices AS (
  SELECT COUNT(*) AS n FROM pg_indexes
  WHERE schemaname = 'public' AND indexname IN (
    'idx_tire_events_tire',             'idx_tire_events_client',
    'idx_shipper_events_shipper',       'idx_shipper_events_client',
    'idx_operational_unit_events_unit', 'idx_operational_unit_events_client',
    'idx_client_events_client')
), gatilhos AS (
  SELECT COUNT(*) AS n FROM pg_trigger t
  WHERE NOT t.tgisinternal AND t.tgname IN (
    'trg_audit_tire_insert',                 'trg_audit_tire_update',
    'trg_audit_shipper_insert',              'trg_audit_shipper_update',
    'trg_audit_operational_unit_insert',     'trg_audit_operational_unit_update',
    'trg_audit_client_insert',               'trg_audit_client_update',
    'trg_tire_events_immutable',             'trg_shipper_events_immutable',
    'trg_operational_unit_events_immutable', 'trg_client_events_immutable')
), funcoes AS (
  SELECT
    COUNT(*) AS n,
    COUNT(*) FILTER (WHERE pr.prosecdef) AS n_secdef
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public' AND pr.proname IN (
    'fn_audit_jsonb_diff', 'fn_audit_tire', 'fn_audit_shipper',
    'fn_audit_operational_unit', 'fn_audit_client')
), fase1 AS (
  SELECT COUNT(*) AS n
  FROM pg_proc pr
  JOIN pg_namespace ns ON ns.oid = pr.pronamespace
  WHERE ns.nspname = 'public' AND pr.proname IN (
    'fn_audit_actor', 'fn_audit_events_immutable')
), colunas_client_events AS (
  SELECT COUNT(*) AS n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'client_events'
), perfis AS (
  SELECT COUNT(*) AS n FROM public.profiles WHERE name IS NULL
)
SELECT 'tabelas'              AS objeto, tabelas.n::text AS encontrado, '4' AS esperado,
       CASE WHEN tabelas.n = 4 THEN 'OK' ELSE 'FALTANDO' END AS status FROM tabelas
UNION ALL
SELECT 'rls_habilitada',      rls.n::text,      '4', CASE WHEN rls.n      = 4 THEN 'OK' ELSE 'FALTANDO' END FROM rls
UNION ALL
SELECT 'policies_select',     policies.n_select::text,  '4', CASE WHEN policies.n_select  = 4 THEN 'OK' ELSE 'FALTANDO' END FROM policies
UNION ALL
SELECT 'policies_de_escrita', policies.n_escrita::text, '0', CASE WHEN policies.n_escrita = 0 THEN 'OK' ELSE 'FALTANDO' END FROM policies
UNION ALL
SELECT 'indices',             indices.n::text,  '7', CASE WHEN indices.n  = 7 THEN 'OK' ELSE 'FALTANDO' END FROM indices
UNION ALL
SELECT 'gatilhos',            gatilhos.n::text, '12', CASE WHEN gatilhos.n = 12 THEN 'OK' ELSE 'FALTANDO' END FROM gatilhos
UNION ALL
SELECT 'funcoes_fase3',       funcoes.n::text,  '5', CASE WHEN funcoes.n  = 5 THEN 'OK' ELSE 'FALTANDO' END FROM funcoes
UNION ALL
SELECT 'funcoes_security_definer', funcoes.n_secdef::text, '4', CASE WHEN funcoes.n_secdef = 4 THEN 'OK' ELSE 'FALTANDO' END FROM funcoes
UNION ALL
SELECT 'funcoes_fase1_presentes',  fase1.n::text, '2', CASE WHEN fase1.n = 2 THEN 'OK' ELSE 'FALTANDO' END FROM fase1
UNION ALL
SELECT 'colunas_client_events',    colunas_client_events.n::text, '7', CASE WHEN colunas_client_events.n = 7 THEN 'OK' ELSE 'FALTANDO' END FROM colunas_client_events
UNION ALL
SELECT 'perfis_sem_nome',          perfis.n::text, '0', CASE WHEN perfis.n = 0 THEN 'OK' ELSE 'ATENCAO' END FROM perfis;
-- Esperado: 11 linhas, todas com status = 'OK'.
