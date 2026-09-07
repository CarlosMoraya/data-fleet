-- =============================================================================
-- 20260907000001_fix_prod_meli_operational_units.sql
--
-- Módulo Utilização MELI — Etapa 0.
-- Corrige dois defeitos de dados apurados em PROD em 2026-09-07.
--
-- ⚠️ SOMENTE PROD. Não aplicar em DEV — o cliente de DEV não tem unidades.
-- ORDEM: depois da 20260907000000.
--
-- CONTEXTO
-- O módulo casa a unidade operacional do BetaFleet com o `service_center` da
-- LAST_ROUT pelo campo `code`. Dois registros quebram essa junção:
--   1. `SRJ4` está ativa e correta, mas com `code = NULL`.
--   2. `EES5` está duplicada: a linha inativa tem `code = 'EES5'` e a ATIVA tem
--      `code = 'XPT'` — que não é um service_center válido da LAST_ROUT.
--
-- Nenhum DELETE. A duplicata inativa permanece: pode haver veículos históricos
-- apontando para ela, e removê-la quebraria a FK.
-- =============================================================================

-- 1. SRJ4 sem código
UPDATE public.operational_units
   SET code = 'SRJ4'
 WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
   AND name = 'SRJ4'
   AND code IS NULL;

-- 2. EES5 ativa com código errado
UPDATE public.operational_units
   SET code = 'EES5'
 WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
   AND name = 'EES5'
   AND code = 'XPT';

-- =============================================================================
-- CONFERÊNCIA (rodar após aplicar)
-- =============================================================================
-- Esperado: SRJ4 com code = 'SRJ4'; a EES5 ativa com code = 'EES5';
-- a Ees5 inativa permanece com code = 'EES5' e active = false.
--
-- SELECT name, code, active
--   FROM public.operational_units
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND name ILIKE ANY (ARRAY['SRJ4','EES5'])
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
-- ROLLBACK
-- =============================================================================
-- UPDATE public.operational_units SET code = NULL
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4' AND name = 'SRJ4';
-- UPDATE public.operational_units SET code = 'XPT'
--  WHERE client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND name = 'EES5' AND active = true;
