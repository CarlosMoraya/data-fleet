-- =============================================================================
-- 20260907000001_fix_prod_meli_operational_units.sql
--
-- Módulo Utilização MELI — Etapa 0.
-- Corrige dois defeitos de dados apurados em PROD em 2026-09-07.
--
-- ⚠️ SOMENTE PROD. Não aplicar em DEV — o cliente de DEV não tem unidades.
-- ORDEM: depois da 20260907000000.
--
-- STATUS: aplicada e validada em PROD em 2026-09-07 (versão abaixo, com a
-- correção descrita na nota de 2026-09-07 mais adiante).
--
-- CONTEXTO
-- O módulo casa a unidade operacional do BetaFleet com o `service_center` da
-- LAST_ROUT pelo campo `code`. Dois registros quebram essa junção:
--   1. `SRJ4` está ativa e correta, mas com `code = NULL`.
--   2. `EES5` está duplicada: a linha inativa tem `name = 'Ees5'` (minúsculas
--      no meio) e `code = 'EES5'`; a linha ATIVA tem `name = 'EES5'` e
--      `code = 'XPT'` — que não é um service_center válido da LAST_ROUT.
--
-- Nenhum DELETE. A duplicata inativa permanece: pode haver veículos históricos
-- apontando para ela, e removê-la quebraria a FK.
--
-- NOTA (2026-09-07) — schema drift DEV × PROD e correção aplicada
-- A primeira versão desta migration tentava, num único passo, atribuir
-- `code = 'EES5'` à linha ativa. Isso falhou em PROD com
-- `23505 duplicate key value violates unique constraint
-- "operational_units_client_code_unique"`: PROD tem uma constraint
-- `UNIQUE (client_id, code)` em `operational_units` que **DEV não tem**
-- (verificado nas duas bases; não catalogado antes de rodar esta migration —
-- falha de planejamento, registrada em `docs/EXECUTOR-TRACK-RECORD.md`).
-- Como a linha inativa já ocupava `code = 'EES5'`, a constraint recusou o
-- segundo registro com o mesmo valor. O SQL Editor do Supabase roda o lote
-- inteiro numa transação implícita, então o `UPDATE` do SRJ4 (passo 1) também
-- foi revertido junto com o erro do passo 2 — nada ficou aplicado pela
-- primeira tentativa.
--
-- Também foi descoberto que o filtro original `name = 'EES5'` (exato,
-- maiúsculas) não teria alcançado a linha inativa mesmo sem a constraint —
-- o `name` dela é `'Ees5'`, e comparação de texto no Postgres é
-- case-sensitive por padrão. A versão abaixo usa `upper(name)` para não
-- depender da grafia exata.
--
-- Correção: liberar o código da linha inativa (`code = NULL`) antes de
-- atribuí-lo à linha ativa — três passos em vez de dois, mesma garantia de
-- nenhum DELETE.
-- =============================================================================

-- 1. Libera 'EES5' da linha inativa (mantém a linha, só remove o código)
UPDATE public.operational_units
   SET code = NULL
 WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
   AND upper(name) = 'EES5'
   AND active = false;

-- 2. Atribui 'EES5' à linha ativa
UPDATE public.operational_units
   SET code = 'EES5'
 WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
   AND upper(name) = 'EES5'
   AND active = true;

-- 3. SRJ4 sem código
UPDATE public.operational_units
   SET code = 'SRJ4'
 WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
   AND upper(name) = 'SRJ4'
   AND code IS NULL;

-- =============================================================================
-- CONFERÊNCIA (rodada em PROD em 2026-09-07 — resultado confirmado)
-- =============================================================================
-- Esperado: Ees5 (inativa) com code = NULL; EES5 (ativa) com code = 'EES5';
-- SRJ4 (ativa) com code = 'SRJ4'.
--
-- SELECT name, code, active
--   FROM public.operational_units
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND upper(name) IN ('SRJ4', 'EES5')
--  ORDER BY name, active DESC;
--
-- Cobertura da junção (esperado: 11 das 19 unidades MELI casando com a Neon —
-- 10 que já casavam mais SRJ4). Os 8 service_center restantes da Neon não têm
-- unidade em PROD, e isso é esperado: a unidade exibida vem da rota.
--
-- SELECT ou.code, ou.active
--   FROM public.operational_units ou
--   JOIN public.shippers s ON s.id = ou.shipper_id
--  WHERE ou.client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND s.name = 'MERCADO LIVRE'
--    AND ou.code IS NOT NULL
--  ORDER BY ou.code;

-- =============================================================================
-- ROLLBACK (ordem inversa, para não colidir com a mesma constraint)
-- =============================================================================
-- UPDATE public.operational_units SET code = NULL
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND upper(name) = 'SRJ4';
-- UPDATE public.operational_units SET code = 'XPT'
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND upper(name) = 'EES5' AND active = true;
-- UPDATE public.operational_units SET code = 'EES5'
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND upper(name) = 'EES5' AND active = false;
