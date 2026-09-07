-- ============================================================
-- MIGRATION: create_fuel_supplies
-- Descrição: Módulo de Abastecimento (βetaFleet)
--   - fuel_supplies: espelho dos abastecimentos vindos da API
--     Veloe (endpoint "Histórico de Abastecimento"), alimentado
--     exclusivamente pela Edge Function `veloe-fuel-sync`
--     usando a service_role.
--
-- Somente leitura para usuários autenticados: não existe
-- política de INSERT/UPDATE/DELETE — a tabela é espelho de um
-- sistema externo e nenhum usuário pode escrevê-la.
--
-- LGPD: é PROIBIDO acrescentar aqui qualquer coluna que
-- armazene CPF/`registry`, número de cartão completo,
-- `refreshToken`, `accessToken` ou o payload bruto da Veloe.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- ─── 1. Tabela fuel_supplies ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fuel_supplies (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id          UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id           UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  plate               TEXT NOT NULL,
  driver_name         TEXT,
  vehicle_model       TEXT,
  fuel_type           TEXT,
  amount_liters       NUMERIC(12,3),
  unit_value          NUMERIC(12,4),
  total_value         NUMERIC(14,2),
  odometer            BIGINT,
  previous_odometer   BIGINT,
  km_traveled         NUMERIC(12,2),
  standard_average    NUMERIC(10,2),
  transaction_date    TIMESTAMPTZ NOT NULL,
  transaction_status  TEXT,
  authorization_code  TEXT,
  supply_location     TEXT,
  network             TEXT,
  merchant_state      TEXT,
  cost_center         TEXT,
  base_code           TEXT,
  base_name           TEXT,
  card_last4          TEXT,
  source              TEXT NOT NULL DEFAULT 'veloe',
  external_key        TEXT NOT NULL,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fuel_supplies_external_key_unique UNIQUE (client_id, external_key)
);

-- ─── 2. Índices ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fuel_supplies_client_date
  ON public.fuel_supplies(client_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_supplies_vehicle
  ON public.fuel_supplies(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_supplies_plate
  ON public.fuel_supplies(client_id, plate);

-- ─── 3. RLS ───────────────────────────────────────────────────

ALTER TABLE public.fuel_supplies ENABLE ROW LEVEL SECURITY;

-- ── fuel_supplies: SELECT (Fleet Analyst+ do próprio tenant OU Admin Master) ──
CREATE POLICY "fuel_supplies_select" ON public.fuel_supplies
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 4
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- Nenhuma política de INSERT, UPDATE ou DELETE para `authenticated`.
-- Toda escrita ocorre pela Edge Function `veloe-fuel-sync` com a
-- service_role, que ignora RLS.
