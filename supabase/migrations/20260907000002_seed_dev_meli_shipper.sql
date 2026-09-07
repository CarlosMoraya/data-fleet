-- =============================================================================
-- 20260907000002_seed_dev_meli_shipper.sql
--
-- Módulo Utilização MELI — Etapa 0.
-- Semeia o ambiente de DEV, que hoje não tem embarcador nem unidade nenhuma
-- (verificado em 2026-09-07: 298 veículos, 0 shippers, 0 operational_units,
-- 0 veículos com shipper_id).
--
-- ⚠️ SOMENTE DEV. Não aplicar em produção.
-- ORDEM: depois da 20260907000000.
--
-- POR QUE COM CASOS NEGATIVOS
-- Se todos os 298 veículos virassem "MELI + dedicado", o filtro central do
-- módulo (embarcador = MERCADO LIVRE E is_dedicated = true) ficaria intestável,
-- porque nada seria excluído por ele. A distribuição abaixo cria os dois casos
-- negativos de propósito:
--   - 20 veículos em outro embarcador  → testa a exclusão por embarcador
--   - 15 veículos MELI não dedicados   → testa a exclusão pela flag
--   - 263 veículos MELI dedicados      → o conjunto do módulo
--
-- IDEMPOTÊNCIA
-- Não existe UNIQUE em shippers(client_id, name) nem em operational_units
-- (só shippers_client_id_cnpj_key). Por isso os INSERT são guardados por
-- NOT EXISTS / SELECT prévio, e não por ON CONFLICT.
-- A distribuição é determinística (ORDER BY license_plate, id), então reaplicar
-- produz exatamente o mesmo resultado.
-- =============================================================================

DO $$
DECLARE
  v_client  uuid := '6c5daeb6-df37-4e61-93c4-41975bf846c6';
  v_meli    uuid;
  v_brf     uuid;
  v_brfduq  uuid;
  v_codes   text[] := ARRAY[
    'SES1','SES2','SMG3','SMG14','SRJ1','SRJ4','SRJ6','SRJ7','SRJ8','SRJ10','SRJ13'
  ];
  v_code    text;
  v_units   integer;
  v_total   integer;
BEGIN
  -- Guard: a coluna is_dedicated precisa existir (migration 20260907000000).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vehicles'
       AND column_name = 'is_dedicated'
  ) THEN
    RAISE EXCEPTION
      'Coluna vehicles.is_dedicated ausente. Aplique 20260907000000_add_vehicle_is_dedicated.sql primeiro.';
  END IF;

  -- Guard: não rodar no cliente errado.
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_client) THEN
    RAISE EXCEPTION 'Cliente de DEV % não existe neste banco. Esta migration é SOMENTE DEV.', v_client;
  END IF;

  -- ---------------------------------------------------------------- embarcadores
  SELECT id INTO v_meli
    FROM public.shippers
   WHERE client_id = v_client AND name = 'MERCADO LIVRE'
   LIMIT 1;

  IF v_meli IS NULL THEN
    INSERT INTO public.shippers (client_id, name, active)
    VALUES (v_client, 'MERCADO LIVRE', true)
    RETURNING id INTO v_meli;
  END IF;

  SELECT id INTO v_brf
    FROM public.shippers
   WHERE client_id = v_client AND name = 'BRF'
   LIMIT 1;

  IF v_brf IS NULL THEN
    INSERT INTO public.shippers (client_id, name, active)
    VALUES (v_client, 'BRF', true)
    RETURNING id INTO v_brf;
  END IF;

  -- ------------------------------------------------------- unidades operacionais
  -- Os códigos espelham os service_center reais da LAST_ROUT, com name = code.
  FOREACH v_code IN ARRAY v_codes LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.operational_units
       WHERE client_id = v_client AND shipper_id = v_meli AND code = v_code
    ) THEN
      INSERT INTO public.operational_units (client_id, shipper_id, name, code, active)
      VALUES (v_client, v_meli, v_code, v_code, true);
    END IF;
  END LOOP;

  SELECT id INTO v_brfduq
    FROM public.operational_units
   WHERE client_id = v_client AND shipper_id = v_brf AND code = 'BRFDUQ'
   LIMIT 1;

  IF v_brfduq IS NULL THEN
    INSERT INTO public.operational_units (client_id, shipper_id, name, code, active)
    VALUES (v_client, v_brf, 'BRF DUQ', 'BRFDUQ', true)
    RETURNING id INTO v_brfduq;
  END IF;

  SELECT count(*) INTO v_units
    FROM public.operational_units
   WHERE client_id = v_client AND shipper_id = v_meli;

  IF v_units = 0 THEN
    RAISE EXCEPTION 'Nenhuma unidade operacional MELI criada — abortando a distribuição.';
  END IF;

  -- ------------------------------------------------------------- distribuição
  -- Determinística por license_plate: reaplicar dá o mesmo resultado.
  --   rn <= 20        → BRF / BRFDUQ / não dedicado
  --   rn 21..35       → MELI / unidade em rodízio / não dedicado
  --   rn >= 36        → MELI / unidade em rodízio / DEDICADO
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY license_plate, id) AS rn
      FROM public.vehicles
     WHERE client_id = v_client
  ),
  meli_units AS (
    SELECT id, row_number() OVER (ORDER BY code) - 1 AS idx
      FROM public.operational_units
     WHERE client_id = v_client AND shipper_id = v_meli
  )
  UPDATE public.vehicles v
     SET shipper_id = CASE WHEN o.rn <= 20 THEN v_brf ELSE v_meli END,
         operational_unit_id = CASE
           WHEN o.rn <= 20 THEN v_brfduq
           ELSE (SELECT u.id FROM meli_units u WHERE u.idx = (o.rn - 21) % v_units)
         END,
         is_dedicated = (o.rn > 35)
    FROM ordered o
   WHERE v.id = o.id;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  RAISE NOTICE 'Seed DEV concluído: % veículos distribuídos entre % unidades MELI.', v_total, v_units;
END $$;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- CONFERÊNCIA (rodar após aplicar)
-- =============================================================================
-- Esperado, com 298 veículos:
--   MERCADO LIVRE / dedicado = true   → 263
--   MERCADO LIVRE / dedicado = false  →  15
--   BRF           / dedicado = false  →  20
--
-- SELECT s.name AS embarcador, v.is_dedicated, count(*) AS veiculos
--   FROM public.vehicles v
--   LEFT JOIN public.shippers s ON s.id = v.shipper_id
--  WHERE v.client_id = '6c5daeb6-df37-4e61-93c4-41975bf846c6'
--  GROUP BY 1, 2 ORDER BY 1, 2;
--
-- Distribuição por unidade (esperado: 11 unidades, ~25 veículos cada):
-- SELECT ou.code, count(*) AS veiculos
--   FROM public.vehicles v
--   JOIN public.operational_units ou ON ou.id = v.operational_unit_id
--  WHERE v.client_id = '6c5daeb6-df37-4e61-93c4-41975bf846c6'
--  GROUP BY 1 ORDER BY 1;

-- =============================================================================
-- ROLLBACK (desfaz a distribuição; mantém shippers e unidades criados)
-- =============================================================================
-- UPDATE public.vehicles
--    SET shipper_id = NULL, operational_unit_id = NULL, is_dedicated = false
--  WHERE client_id = '6c5daeb6-df37-4e61-93c4-41975bf846c6';
