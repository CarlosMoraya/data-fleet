-- ============================================================
-- MIGRATION: register_missing_schema_elements
-- Data: 2026-06-19
-- Descrição: Registra no projeto todos os elementos de schema
--            que existem nos bancos (dev e prod) mas nunca foram
--            capturados em arquivos de migration.
--
-- Origem das lacunas:
-- - Tabelas vehicles e vehicle_field_settings criadas manualmente
--   via Supabase Dashboard (sem migration correspondente)
-- - Funções helper (get_my_client_id, get_my_role, is_admin_master,
--   set_updated_at) criadas manualmente
-- - role_rank() teve apenas CREATE OR REPLACE, sem criação inicial
-- - Trigger vehicles_updated_at criada manualmente
-- - Colunas can_delete_vehicles e can_delete_workshops em profiles
--   adicionadas manualmente
-- - Index vehicles_client_plate_uniq criado manualmente
-- - Constraint vehicles_energy_source_check criada manualmente
-- - Dashboard functions foram rollbacked no arquivo mas não no DB
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- ============================================================
-- SEÇÃO 1: Funções helper (usadas por dezenas de RLS policies)
-- ============================================================

-- get_my_client_id() — retorna o client_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_client_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT client_id FROM public.profiles WHERE id = auth.uid(); $$;

-- get_my_role() — retorna o role do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

-- is_admin_master() — verifica se o usuário é Admin Master
CREATE OR REPLACE FUNCTION public.is_admin_master() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin Master'); $$;

-- role_rank() — hierarquia de roles (versão canônica)
CREATE OR REPLACE FUNCTION public.role_rank(role_name text) RETURNS integer
  LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'Driver' THEN 0
    WHEN 'Yard Auditor' THEN 1
    WHEN 'Workshop' THEN 2
    WHEN 'Fleet Assistant' THEN 3
    WHEN 'Fleet Analyst' THEN 4
    WHEN 'Supervisor' THEN 5
    WHEN 'Operations Manager' THEN 5
    WHEN 'Coordinator' THEN 6
    WHEN 'Manager' THEN 7
    WHEN 'Director' THEN 8
    WHEN 'Admin Master' THEN 9
    ELSE 0
  END;
END;
$$;

-- set_updated_at() — trigger function para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- handle_updated_at() — alias alternativo (mesma lógica)
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- SEÇÃO 2: Tabela vehicles (base — nunca teve migration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vehicles (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id                 uuid NOT NULL REFERENCES public.clients(id),
  type                      text NOT NULL CHECK (type IN ('Passeio','Utilitário','Van','Moto','Vuc','Toco','Truck','Cavalo')),
  energy_source             text NOT NULL CHECK (energy_source IN ('Combustão','Elétrico','Híbrido')),
  cooling_equipment         boolean DEFAULT false NOT NULL,
  semi_reboque              boolean,
  placa_semi_reboque        text,
  fuel_type                 text,
  tank_capacity             numeric,
  avg_consumption           numeric,
  cooling_brand             text,
  license_plate             text NOT NULL,
  renavam                   text NOT NULL,
  chassi                    text NOT NULL,
  detran_uf                 text NOT NULL,
  year                      integer NOT NULL,
  color                     text NOT NULL,
  acquisition               text NOT NULL CHECK (acquisition IN ('Owned','Rented','Agregado')),
  fipe_price                numeric DEFAULT 0 NOT NULL,
  tracker                   text DEFAULT '' NOT NULL,
  antt                      text DEFAULT '' NOT NULL,
  owner                     text DEFAULT '' NOT NULL,
  status                    text DEFAULT 'Available' NOT NULL CHECK (status IN ('Available','Maintenance','In Use')),
  autonomy                  numeric DEFAULT 0 NOT NULL,
  acquisition_date          date,
  crlv_upload               text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  driver_id                 uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  shipper_id                uuid REFERENCES public.shippers(id) ON DELETE SET NULL,
  operational_unit_id       uuid REFERENCES public.operational_units(id) ON DELETE SET NULL,
  initial_km                integer,
  pbt                       real,
  cmt                       real,
  eixos                     integer,
  vehicle_usage             text CHECK (vehicle_usage IN ('Operação','Uso Administrativo','Uso por Lideranças','Outros')),
  warranty                  boolean DEFAULT false NOT NULL,
  warranty_end_date         date,
  first_revision_max_km     integer,
  first_revision_deadline   date,
  cooling_first_revision_deadline date,
  has_insurance             boolean DEFAULT false NOT NULL,
  insurance_policy_upload   text,
  has_maintenance_contract  boolean DEFAULT false NOT NULL,
  maintenance_contract_upload text,
  axle_config               jsonb,
  steps_count               integer,
  crlv_expiration_date      date,
  brand                     text DEFAULT '' NOT NULL,
  model                     text DEFAULT '' NOT NULL,
  crlv_year                 text,
  tag                       text,
  sanitary_inspection_upload text,
  spare_key                 boolean DEFAULT false NOT NULL,
  vehicle_manual            boolean DEFAULT false NOT NULL,
  gr_upload                 text,
  gr_expiration_date        date,
  category                  text CHECK (category IS NULL OR category IN ('Leve','Médio','Pesado','Elétrico'))
);

-- Índice único: placa por cliente
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_client_plate_uniq
  ON public.vehicles(client_id, license_plate);

-- Índice: driver_id único parcial (já existente em migration, IF NOT EXISTS protege)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_client_driver_unique
  ON public.vehicles(client_id, driver_id) WHERE driver_id IS NOT NULL;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS vehicles_shipper_id_idx ON public.vehicles(shipper_id);
CREATE INDEX IF NOT EXISTS vehicles_op_unit_id_idx ON public.vehicles(operational_unit_id);

-- Trigger: updated_at automático
DROP TRIGGER IF EXISTS vehicles_updated_at ON public.vehicles;
CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Constraint vehicles_category_check (pode não existir se a tabela foi criada antes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicles_category_check'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_category_check
      CHECK (category IS NULL OR category IN ('Leve','Médio','Pesado','Elétrico'));
  END IF;
END $$;

-- ============================================================
-- SEÇÃO 3: Tabela vehicle_field_settings (base — nunca teve migration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vehicle_field_settings (
  id                              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id                       uuid NOT NULL UNIQUE REFERENCES public.clients(id),
  renavam_optional                boolean DEFAULT false NOT NULL,
  chassi_optional                 boolean DEFAULT false NOT NULL,
  detran_uf_optional              boolean DEFAULT false NOT NULL,
  color_optional                  boolean DEFAULT false NOT NULL,
  owner_optional                  boolean DEFAULT false NOT NULL,
  fipe_price_optional             boolean DEFAULT false NOT NULL,
  tracker_optional                boolean DEFAULT false NOT NULL,
  antt_optional                   boolean DEFAULT false NOT NULL,
  autonomy_optional               boolean DEFAULT false NOT NULL,
  acquisition_date_optional       boolean DEFAULT false NOT NULL,
  tag_optional                    boolean DEFAULT false NOT NULL,
  category_optional               boolean DEFAULT false NOT NULL,
  crlv_upload_optional            boolean DEFAULT false NOT NULL,
  sanitary_inspection_optional    boolean DEFAULT false NOT NULL,
  gr_upload_optional              boolean DEFAULT false NOT NULL,
  gr_expiration_date_optional     boolean DEFAULT false NOT NULL,
  fuel_type_optional              boolean DEFAULT false NOT NULL,
  tank_capacity_optional          boolean DEFAULT false NOT NULL,
  avg_consumption_optional        boolean DEFAULT false NOT NULL,
  cooling_brand_optional          boolean DEFAULT false NOT NULL,
  placa_semi_reboque_optional     boolean DEFAULT false NOT NULL,
  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now(),
  initial_km_optional             boolean DEFAULT false NOT NULL,
  pbt_optional                    boolean DEFAULT false NOT NULL,
  cmt_optional                    boolean DEFAULT false NOT NULL,
  eixos_optional                  boolean DEFAULT false NOT NULL,
  vehicle_usage_optional          boolean DEFAULT false NOT NULL,
  warranty_end_date_optional      boolean DEFAULT false NOT NULL,
  first_revision_max_km_optional  boolean DEFAULT false NOT NULL,
  first_revision_deadline_optional boolean DEFAULT false NOT NULL,
  cooling_first_revision_deadline_optional boolean DEFAULT false NOT NULL,
  insurance_policy_upload_optional boolean DEFAULT false NOT NULL,
  maintenance_contract_upload_optional boolean DEFAULT false NOT NULL,
  vehicle_category                text,
  is_free_form                    boolean DEFAULT false NOT NULL,
  CONSTRAINT check_free_form_or_category CHECK (
    (is_free_form = true AND vehicle_category IS NULL)
    OR (is_free_form = false AND vehicle_category IS NOT NULL)
  )
);

-- ============================================================
-- SEÇÃO 4: Colunas missing em profiles
-- ============================================================

-- can_delete_vehicles (referenciada por RLS policies desde create_drivers_tables.sql)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_delete_vehicles boolean DEFAULT false NOT NULL;

-- can_delete_workshops (referenciada por RLS policies em workshops)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_delete_workshops boolean DEFAULT false NOT NULL;

-- workshop_account_id (adicionada em 20260404000000_workshop_partnership.sql)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workshop_account_id uuid REFERENCES public.workshop_accounts(id) ON DELETE SET NULL;

-- budget_approval_limit (adicionada em add_budget_approval_limit.sql)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS budget_approval_limit numeric DEFAULT 0 NOT NULL;

-- ============================================================
-- SEÇÃO 5: Limpar dashboard functions que foram rollbacked
-- ============================================================
-- A migration 20260617000200_rollback_dashboard_rpcs.sql existe no projeto
-- mas nunca foi aplicada nos bancos. Garantir que sejam removidas.

DROP FUNCTION IF EXISTS public.dashboard_previous_period_cost(uuid, date, date);
DROP FUNCTION IF EXISTS public.dashboard_cost_projection_monthly(uuid, date, date);
DROP FUNCTION IF EXISTS public.dashboard_last_checklist_per_vehicle(uuid);
DROP FUNCTION IF EXISTS public.dashboard_vehicle_km_in_period(uuid, date, date);
