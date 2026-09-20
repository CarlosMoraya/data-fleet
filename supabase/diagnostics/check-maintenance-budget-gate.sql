-- ============================================================
-- DIAGNÓSTICO: trava de orçamento na mudança de status da OS
-- Migration: 20260920000000_enforce_budget_gate_on_maintenance_status
-- Data: 2026-09-20
--
-- Script SOMENTE-LEITURA. Seguro para rodar em DEV e PROD,
-- ANTES e DEPOIS da aplicação da migration.
-- ============================================================

-- ─── 1. colunas ───────────────────────────────────────────────
-- Esperado DEPOIS: 3 linhas, todas is_nullable = 'YES'.
-- Esperado ANTES: 0 linhas.
SELECT
  'colunas' AS secao,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'maintenance_orders'
  AND column_name IN ('budget_override_reason', 'budget_override_by_id', 'budget_override_at')
ORDER BY column_name;

-- Esperado DEPOIS: 1 linha (maintenance_orders_budget_override_by_id_fkey).
-- Esperado ANTES: 0 linhas.
SELECT
  'colunas_fk' AS secao,
  conname      AS constraint_name,
  contype      AS constraint_type
FROM pg_constraint
WHERE conrelid = 'public.maintenance_orders'::regclass
  AND conname = 'maintenance_orders_budget_override_by_id_fkey';

-- ─── 2. gatilho ───────────────────────────────────────────────
-- Esperado DEPOIS: 1 linha, tgenabled = 'O'.
-- Esperado ANTES: 0 linhas.
SELECT
  'gatilho' AS secao,
  tgname,
  tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.maintenance_orders'::regclass
  AND NOT tgisinternal
  AND tgname = 'trg_enforce_maintenance_budget_gate';

-- ─── 3. gatilhos_preexistentes ────────────────────────────────
-- Os gatilhos anteriores de maintenance_orders continuam presentes e habilitados.
-- Esperado ANTES e DEPOIS: 10 linhas, todas tgenabled = 'O'.
-- (O IMPLEMENTATION.md de 2026-09-20 previa 5; a contagem real em DEV é 10.)
SELECT
  'gatilhos_preexistentes' AS secao,
  tgname,
  tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.maintenance_orders'::regclass
  AND NOT tgisinternal
  AND tgname <> 'trg_enforce_maintenance_budget_gate'
ORDER BY tgname;

-- ─── 4. coerencia_regra_a ─────────────────────────────────────
-- OS com status 'Orçamento aprovado' e budget_status diferente de 'aprovado'.
-- Esperado em PROD: 0 antes e depois.
-- Esperado em DEV: 1 antes (linha suja conhecida, sem reparo previsto neste plano).
SELECT
  'coerencia_regra_a' AS secao,
  count(*)            AS os_incoerentes
FROM public.maintenance_orders
WHERE status = 'Orçamento aprovado'
  AND budget_status IS DISTINCT FROM 'aprovado';

-- ─── 5. excecoes_registradas ──────────────────────────────────
-- OS com exceção de orçamento registrada, agrupadas por status.
-- Esperado logo APÓS a aplicação: 0 linhas em ambos os bancos (sem backfill).
SELECT
  'excecoes_registradas' AS secao,
  status,
  count(*) AS total
FROM public.maintenance_orders
WHERE budget_override_reason IS NOT NULL
GROUP BY status
ORDER BY status;
