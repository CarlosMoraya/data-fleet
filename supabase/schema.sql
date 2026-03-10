-- ============================================================
-- DATA FLEET - Schema Supabase
-- Execute este SQL no Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABELA: clients (tenants)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. TABELA: profiles (estende auth.users)
-- Uma linha por usuário autenticado.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN (
               'Driver', 'Yard Auditor', 'Fleet Assistant',
               'Fleet Analyst', 'Manager', 'Director', 'Admin Master'
             )),
  client_id  UUID NOT NULL REFERENCES public.clients(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas o client ao qual pertence
CREATE POLICY "users_read_own_client" ON public.clients
  FOR SELECT
  USING (id = (SELECT client_id FROM public.profiles WHERE id = auth.uid()));

-- Usuário lê apenas o próprio perfil
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- ------------------------------------------------------------
-- 4. TRIGGER: cria perfil automaticamente ao cadastrar usuário
--    (opcional – útil se usar Supabase Invite ou Sign Up)
-- ------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, name, role, client_id)
--   VALUES (
--     NEW.id,
--     COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
--     COALESCE(NEW.raw_user_meta_data->>'role', 'Driver'),
--     (NEW.raw_user_meta_data->>'client_id')::UUID
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 5. SEED: dados iniciais de clients e usuário admin
-- ------------------------------------------------------------

-- Clientes (tenants)
INSERT INTO public.clients (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Logistics'),
  ('00000000-0000-0000-0000-000000000002', 'Global Freight Co.'),
  ('00000000-0000-0000-0000-000000000003', 'FastTrack Delivery')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. LOGO DOS CLIENTES
-- ------------------------------------------------------------

-- Adiciona coluna de logo (URL pública da imagem)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Políticas de acesso total para Admin Master
CREATE POLICY "admin_master_read_all_clients" ON public.clients
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin Master'
  ));

CREATE POLICY "admin_master_insert_clients" ON public.clients
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin Master'
  ));

CREATE POLICY "admin_master_update_clients" ON public.clients
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin Master'
  ));

CREATE POLICY "admin_master_delete_clients" ON public.clients
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin Master'
  ));

-- Bucket de storage para logos (execute no Supabase Dashboard → Storage → New bucket)
-- Nome: client-logos | Public: true
--
-- Política de upload (permitir apenas Admin Master / Manager via service role ou dashboard):
-- INSERT policy: auth.role() = 'authenticated'
-- SELECT policy: true  (público para exibição no frontend)
--
-- Para definir a logo de um client manualmente:
-- UPDATE public.clients SET logo_url = 'https://<project>.supabase.co/storage/v1/object/public/client-logos/<filename>' WHERE id = '<CLIENT_UUID>';

-- ------------------------------------------------------------
-- 7. GESTÃO DE USUÁRIOS (Admin Master)
-- ------------------------------------------------------------

-- Função auxiliar SECURITY DEFINER para evitar recursão infinita
-- em políticas da tabela profiles que precisam checar o próprio role.
CREATE OR REPLACE FUNCTION public.is_admin_master()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin Master'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Admin Master lê todos os perfis
CREATE POLICY "admin_master_read_all_profiles" ON public.profiles
  FOR SELECT
  USING (public.is_admin_master());

-- Admin Master edita qualquer perfil (nome, role, client_id)
CREATE POLICY "admin_master_update_profiles" ON public.profiles
  FOR UPDATE
  USING (public.is_admin_master());

-- Admin Master exclui qualquer perfil
CREATE POLICY "admin_master_delete_profiles" ON public.profiles
  FOR DELETE
  USING (public.is_admin_master());

-- ------------------------------------------------------------
-- 8. GESTÃO DE USUÁRIOS (Fleet Assistant+, escopo de unidade)
-- ------------------------------------------------------------

-- Função auxiliar: retorna o role do usuário atual (SECURITY DEFINER evita recursão)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Função auxiliar: retorna o client_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_my_client_id()
RETURNS UUID AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Função auxiliar: rank numérico de um role (para comparação de hierarquia)
CREATE OR REPLACE FUNCTION public.role_rank(role_name TEXT)
RETURNS INT AS $$
  SELECT CASE role_name
    WHEN 'Driver'          THEN 1
    WHEN 'Yard Auditor'    THEN 2
    WHEN 'Fleet Assistant' THEN 3
    WHEN 'Fleet Analyst'   THEN 4
    WHEN 'Manager'         THEN 5
    WHEN 'Director'        THEN 6
    WHEN 'Admin Master'    THEN 7
    ELSE 0
  END;
$$ LANGUAGE SQL IMMUTABLE;

-- Fleet Assistant+ pode ver perfis do mesmo client com role inferior ao seu
CREATE POLICY "tenant_managers_read_profiles" ON public.profiles
  FOR SELECT
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(role) < public.role_rank(public.get_my_role())
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
  );

-- Fleet Assistant+ pode editar perfis do mesmo client com role inferior ao seu
CREATE POLICY "tenant_managers_update_profiles" ON public.profiles
  FOR UPDATE
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(role) < public.role_rank(public.get_my_role())
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
  );

-- Fleet Assistant+ pode excluir perfis do mesmo client com role inferior ao seu
CREATE POLICY "tenant_managers_delete_profiles" ON public.profiles
  FOR DELETE
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(role) < public.role_rank(public.get_my_role())
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
  );

-- ------------------------------------------------------------
-- 9. TABELA: vehicles (frota)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id),

  -- Classificação
  type                TEXT NOT NULL CHECK (type IN ('Light', 'Medium', 'Heavy', 'Cavalo')),
  energy_source       TEXT NOT NULL CHECK (energy_source IN ('Combustão', 'Elétrico', 'Híbrido')),
  cooling_equipment   BOOLEAN NOT NULL DEFAULT false,

  -- Campos condicionais
  semi_reboque        BOOLEAN,
  placa_semi_reboque  TEXT,
  fuel_type           TEXT,
  tank_capacity       NUMERIC,
  avg_consumption     NUMERIC,
  cooling_brand       TEXT,

  -- Identificação
  license_plate       TEXT NOT NULL,
  renavam             TEXT NOT NULL,
  chassi              TEXT NOT NULL,
  detran_uf           TEXT NOT NULL,
  brand_model         TEXT NOT NULL,
  year                INT NOT NULL,
  color               TEXT NOT NULL,

  -- Operacional
  acquisition         TEXT NOT NULL CHECK (acquisition IN ('Owned', 'Rented')),
  fipe_price          NUMERIC NOT NULL DEFAULT 0,
  tracker             TEXT NOT NULL DEFAULT '',
  antt                TEXT NOT NULL DEFAULT '',
  owner               TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL CHECK (status IN ('Available', 'Maintenance', 'In Use')) DEFAULT 'Available',
  autonomy            NUMERIC NOT NULL DEFAULT 0,
  crlv_upload         TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Placa única por tenant (dois tenants podem ter a mesma placa)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_client_plate_uniq
  ON public.vehicles(client_id, license_plate);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Fleet Assistant+ lê veículos do próprio tenant
CREATE POLICY "vehicles_select_tenant" ON public.vehicles
  FOR SELECT
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
  );

-- Admin Master lê todos
CREATE POLICY "vehicles_select_admin" ON public.vehicles
  FOR SELECT
  USING (public.is_admin_master());

-- Fleet Analyst+ insere no próprio tenant
CREATE POLICY "vehicles_insert_tenant" ON public.vehicles
  FOR INSERT
  WITH CHECK (
    client_id = public.get_my_client_id()
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Analyst')
  );

-- Admin Master insere em qualquer tenant
CREATE POLICY "vehicles_insert_admin" ON public.vehicles
  FOR INSERT
  WITH CHECK (public.is_admin_master());

-- Fleet Analyst+ atualiza no próprio tenant
CREATE POLICY "vehicles_update_tenant" ON public.vehicles
  FOR UPDATE
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Analyst')
  );

-- Admin Master atualiza qualquer
CREATE POLICY "vehicles_update_admin" ON public.vehicles
  FOR UPDATE
  USING (public.is_admin_master());

-- Fleet Analyst+ deleta no próprio tenant
CREATE POLICY "vehicles_delete_tenant" ON public.vehicles
  FOR DELETE
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Analyst')
  );

-- Admin Master deleta qualquer
CREATE POLICY "vehicles_delete_admin" ON public.vehicles
  FOR DELETE
  USING (public.is_admin_master());

-- ------------------------------------------------------------
-- PRÓXIMO PASSO: crie o primeiro usuário em
--   Supabase Dashboard → Authentication → Users → Invite User
--   ou via:
--     supabase.auth.signUp({ email, password, options: { data: { name, role, client_id } } })
--
-- Depois insira o perfil manualmente (substitua <USER_UUID>):
--
-- INSERT INTO public.profiles (id, name, role, client_id) VALUES
--   ('<USER_UUID>', 'Admin', 'Admin Master', '00000000-0000-0000-0000-000000000001');
-- ------------------------------------------------------------
