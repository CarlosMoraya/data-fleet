-- ============================================================
-- DIAGNÓSTICO — SOMENTE LEITURA
--
-- Objetivo: verificar se a migration
--   20260712000000_create_extra_payment_requests.sql
-- foi aplicada neste banco.
--
-- ⚠️ Este arquivo NÃO é uma migration. Está fora de
--    supabase/migrations/ de propósito. Ele não cria, não altera
--    e não apaga nada — só consulta catálogos do Postgres.
--
-- COMO USAR:
--   1. Supabase Dashboard → SQL Editor
--   2. Confirme o PROJETO no seletor antes de rodar:
--        DEV  = vvbnbzzhpiksacqudmfu
--        PROD = oajfjdadcicgoxrfrnny
--   3. Rode UMA VEZ EM CADA BANCO e guarde os dois resultados
--
-- Data: 2026-07-19
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PASSO 0 — Em qual banco estou?
-- Rode este bloco primeiro e confira antes de seguir.
-- ════════════════════════════════════════════════════════════

SELECT
  current_database()   AS banco,
  inet_server_addr()   AS host,
  now()                AS executado_em;


-- ════════════════════════════════════════════════════════════
-- PASSO 1 — Inventário dos 10 objetos criados pela migration
--
-- Checar só a tabela não basta: o cenário mais perigoso é a
-- migration ter rodado pela metade. Por isso verificamos todos
-- os objetos, um a um.
-- ════════════════════════════════════════════════════════════

WITH checks AS (

  SELECT 1 AS ord,
         'TABELA extra_payment_requests' AS objeto,
         (to_regclass('public.extra_payment_requests') IS NOT NULL) AS existe

  UNION ALL
  SELECT 2, 'RLS ativo em extra_payment_requests',
    COALESCE((
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'extra_payment_requests'
    ), false)

  UNION ALL
  SELECT 3, 'POLICIES em extra_payment_requests (esperado 3)',
    (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'extra_payment_requests') = 3

  UNION ALL
  SELECT 4, 'COLUNA payment_installments.source_type',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name  = 'payment_installments'
              AND column_name = 'source_type')

  UNION ALL
  SELECT 5, 'COLUNA payment_installments.extra_payment_request_id',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name  = 'payment_installments'
              AND column_name = 'extra_payment_request_id')

  UNION ALL
  SELECT 6, 'INDEX idx_pi_source',
    EXISTS (SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_pi_source')

  UNION ALL
  SELECT 7, 'FUNCTION next_extra_payment_request_number',
    EXISTS (SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'next_extra_payment_request_number')

  UNION ALL
  SELECT 8, 'FUNCTION get_extra_payment_auditors',
    EXISTS (SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'get_extra_payment_auditors')

  UNION ALL
  SELECT 9, 'FUNCTION fn_validate_extra_payment_request_transition',
    EXISTS (SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'fn_validate_extra_payment_request_transition')

  UNION ALL
  SELECT 10, 'TRIGGER trg_validate_extra_payment_request_transition',
    EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_validate_extra_payment_request_transition'
              AND NOT tgisinternal)
)
SELECT
  objeto,
  CASE WHEN existe THEN '✅ EXISTE' ELSE '❌ NÃO EXISTE' END AS resultado
FROM checks
ORDER BY ord;


-- ════════════════════════════════════════════════════════════
-- PASSO 2 — Veredito consolidado
--
--   10/10  → ✅ MIGRATION APLICADA
--    0/10  → ❌ MIGRATION NÃO APLICADA
--   entre  → ⚠️ PARCIAL: pare e analise antes de qualquer ação
-- ════════════════════════════════════════════════════════════

WITH checks AS (
  SELECT (to_regclass('public.extra_payment_requests') IS NOT NULL) AS ok
  UNION ALL SELECT COALESCE((SELECT c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='extra_payment_requests'), false)
  UNION ALL SELECT (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='extra_payment_requests') = 3
  UNION ALL SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_installments'
      AND column_name='source_type')
  UNION ALL SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_installments'
      AND column_name='extra_payment_request_id')
  UNION ALL SELECT EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_pi_source')
  UNION ALL SELECT EXISTS (SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='next_extra_payment_request_number')
  UNION ALL SELECT EXISTS (SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_extra_payment_auditors')
  UNION ALL SELECT EXISTS (SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='fn_validate_extra_payment_request_transition')
  UNION ALL SELECT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgname='trg_validate_extra_payment_request_transition'
      AND NOT tgisinternal)
)
SELECT
  count(*) FILTER (WHERE ok) AS itens_presentes,
  count(*)                   AS itens_esperados,
  CASE
    WHEN count(*) FILTER (WHERE ok) = count(*) THEN '✅ MIGRATION APLICADA'
    WHEN count(*) FILTER (WHERE ok) = 0        THEN '❌ MIGRATION NÃO APLICADA'
    ELSE '⚠️ APLICADA PARCIALMENTE — NAO PROSSEGUIR SEM ANALISAR'
  END AS veredito
FROM checks;


-- ════════════════════════════════════════════════════════════
-- PASSO 3 — Migration relacionada, também registrada como
-- pendente no MEMORY.md
-- (20260714000000_add_budget_rejection_reason_to_maintenance_orders.sql)
-- ════════════════════════════════════════════════════════════

SELECT
  'COLUNA maintenance_orders.budget_rejection_reason' AS objeto,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'maintenance_orders'
      AND column_name  = 'budget_rejection_reason'
  ) THEN '✅ EXISTE' ELSE '❌ NÃO EXISTE' END AS resultado;


-- ════════════════════════════════════════════════════════════
-- PASSO 4 — Histórico do Supabase CLI (informativo)
--
-- ⚠️ Só é preenchido por migrations aplicadas via `supabase db push`.
--    Quem cola SQL direto no Editor NÃO aparece aqui.
--    Portanto: ausência nesta lista NÃO prova que a migration
--    não foi aplicada. O veredito válido é o do PASSO 2.
-- ════════════════════════════════════════════════════════════

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '20260710000000'
ORDER BY version;


-- ════════════════════════════════════════════════════════════
-- PASSO 5 — Volume de dados (rode SÓ se o PASSO 2 deu APLICADA)
--
-- Se a tabela não existir, estas queries dão erro — é esperado.
-- Descomente para rodar.
-- ════════════════════════════════════════════════════════════

-- SELECT count(*) AS total_pedidos_extras
-- FROM public.extra_payment_requests;

-- SELECT source_type, count(*) AS parcelas
-- FROM public.payment_installments
-- GROUP BY source_type;
