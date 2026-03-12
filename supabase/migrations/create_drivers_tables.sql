-- ============================================================
-- MIGRATION: create_drivers_tables
-- Data: 2026-03-11
-- Descrição: Cria as tabelas drivers e driver_field_settings
--            com RLS para controle de acesso por tenant.
-- ============================================================
-- INSTRUÇÕES: Execute este script no Supabase Dashboard → SQL Editor
-- Após executar o SQL, crie o bucket 'driver-documents' em Storage
-- com acesso público (mesmas policies do bucket 'vehicle-documents').
-- ============================================================

-- PASSO 1: Criar tabela principal de motoristas
CREATE TABLE public.drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Core identity (sempre obrigatórios, não configuráveis)
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,           -- armazena somente dígitos (11 chars)

  -- CNH
  issue_date DATE,
  expiration_date DATE,
  cnh_upload TEXT,             -- URL do Storage (bucket: driver-documents)
  registration_number TEXT,
  category TEXT,               -- A, B, AB, AE, etc.
  renach TEXT,

  -- GR do Motorista
  gr_upload TEXT,              -- URL do Storage
  gr_expiration_date DATE,

  -- Certificados (até 3)
  certificate1_upload TEXT,    -- URL do Storage
  course_name1 TEXT,
  certificate2_upload TEXT,
  course_name2 TEXT,
  certificate3_upload TEXT,
  course_name3 TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- CPF único por cliente (sem duplicatas dentro do mesmo tenant)
  UNIQUE(client_id, cpf)
);

-- Índice para buscas rápidas por cliente
CREATE INDEX idx_drivers_client_id ON public.drivers(client_id);

-- Trigger updated_at (requer extensão moddatetime)
-- Se moddatetime não estiver instalada, usar trigger manual:
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
-- CREATE TRIGGER set_drivers_updated_at BEFORE UPDATE ON public.drivers
-- FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- PASSO 2: Habilitar RLS na tabela drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant+ do próprio tenant | Admin Master vê todos
CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- INSERT: Fleet Assistant+ do próprio tenant
CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT WITH CHECK (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master')
  );

-- UPDATE: Fleet Analyst+ do próprio tenant
CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Fleet Analyst', 'Manager', 'Director', 'Admin Master')
  );

-- DELETE: Manager+ OU Fleet Analyst com flag can_delete_vehicles
CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager', 'Director', 'Admin Master')
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Fleet Analyst'
        AND (SELECT can_delete_vehicles FROM public.profiles WHERE id = auth.uid()) = true
      )
    )
  );


-- PASSO 3: Criar tabela de configurações de campos do motorista (per-client)
CREATE TABLE public.driver_field_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,

  -- CNH
  issue_date_optional BOOLEAN NOT NULL DEFAULT false,
  expiration_date_optional BOOLEAN NOT NULL DEFAULT false,
  cnh_upload_optional BOOLEAN NOT NULL DEFAULT false,
  registration_number_optional BOOLEAN NOT NULL DEFAULT false,
  category_optional BOOLEAN NOT NULL DEFAULT false,
  renach_optional BOOLEAN NOT NULL DEFAULT false,

  -- GR
  gr_upload_optional BOOLEAN NOT NULL DEFAULT false,
  gr_expiration_date_optional BOOLEAN NOT NULL DEFAULT false,

  -- Certificados
  certificate1_upload_optional BOOLEAN NOT NULL DEFAULT false,
  course_name1_optional BOOLEAN NOT NULL DEFAULT false,
  certificate2_upload_optional BOOLEAN NOT NULL DEFAULT false,
  course_name2_optional BOOLEAN NOT NULL DEFAULT false,
  certificate3_upload_optional BOOLEAN NOT NULL DEFAULT false,
  course_name3_optional BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PASSO 4: Habilitar RLS na tabela driver_field_settings
ALTER TABLE public.driver_field_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant+ do próprio tenant
CREATE POLICY "dfs_select" ON public.driver_field_settings
  FOR SELECT USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master')
  );

-- INSERT: Manager+ do próprio tenant
CREATE POLICY "dfs_insert" ON public.driver_field_settings
  FOR INSERT WITH CHECK (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Manager', 'Director', 'Admin Master')
  );

-- UPDATE: Manager+ do próprio tenant
CREATE POLICY "dfs_update" ON public.driver_field_settings
  FOR UPDATE USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Manager', 'Director', 'Admin Master')
  );


-- VERIFICAÇÃO: rodar estas queries após executar para confirmar
-- SELECT COUNT(*) FROM public.drivers;
-- SELECT COUNT(*) FROM public.driver_field_settings;
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('drivers', 'driver_field_settings');
