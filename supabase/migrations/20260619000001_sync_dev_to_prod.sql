-- ============================================================
-- SYNC: DEV → espelhar estrutura do PROD
-- Descrição: Aplica no DEV tudo que existe no PROD e ainda
--            não foi aplicado no DEV.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV)
-- ============================================================

-- ─── 1. Adicionar 'Agregado' ao CHECK de acquisition ────────

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_acquisition_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_acquisition_check
  CHECK (acquisition IN ('Owned', 'Rented', 'Agregado'));

-- ─── 2. Remover coluna brand_model (redundante com brand/model) ─

-- A migration 20260619000000 já fez o backfill de brand_model → brand + model.
-- Agora podemos remover a coluna legada com segurança.
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS brand_model;

-- ─── 3. Tornar brand e model NOT NULL com DEFAULT '' ────────
-- (garante que veículos existentes sem marca/modelo recebam '')

UPDATE public.vehicles SET brand = '' WHERE brand IS NULL;
ALTER TABLE public.vehicles ALTER COLUMN brand SET DEFAULT '';
ALTER TABLE public.vehicles ALTER COLUMN brand SET NOT NULL;

UPDATE public.vehicles SET model = '' WHERE model IS NULL;
ALTER TABLE public.vehicles ALTER COLUMN model SET DEFAULT '';
ALTER TABLE public.vehicles ALTER COLUMN model SET NOT NULL;

-- ─── 4. Criar função handle_updated_at (usada no PROD) ──────

CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── 5. Atualizar trigger para usar handle_updated_at ───────

DROP TRIGGER IF EXISTS set_maintenance_updated_at ON public.maintenance_orders;
CREATE TRIGGER set_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 6. Remover CASCADE da FK vehicle_field_settings ────────
-- (igualar ao PROD: bloqueia exclusão do cliente se houver settings)

ALTER TABLE public.vehicle_field_settings
  DROP CONSTRAINT IF EXISTS vehicle_field_settings_client_id_fkey;

ALTER TABLE public.vehicle_field_settings
  ADD CONSTRAINT vehicle_field_settings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id);

-- ─── 7. Adicionar policies tenant_managers_* em profiles ────
-- (existem no PROD, faltam no DEV)

CREATE POLICY "tenant_managers_read_profiles" ON public.profiles
  FOR SELECT USING (
    (client_id = public.get_my_client_id())
    AND (public.role_rank(role) < public.role_rank(public.get_my_role()))
    AND (public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant'))
  );

CREATE POLICY "tenant_managers_update_profiles" ON public.profiles
  FOR UPDATE USING (
    (client_id = public.get_my_client_id())
    AND (public.role_rank(role) < public.role_rank(public.get_my_role()))
    AND (public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant'))
  );

CREATE POLICY "tenant_managers_delete_profiles" ON public.profiles
  FOR DELETE USING (
    (client_id = public.get_my_client_id())
    AND (public.role_rank(role) < public.role_rank(public.get_my_role()))
    AND (public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant'))
  );

-- ─── 8. Atualizar policies de drivers — incluir Supervisor e Coordinator ─

-- INSERT: adicionar Supervisor e Coordinator
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT WITH CHECK (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Coordinator', 'Manager', 'Director', 'Admin Master')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- UPDATE: adicionar Supervisor e Coordinator
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Analyst', 'Supervisor', 'Coordinator', 'Manager', 'Director', 'Admin Master')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- DELETE: adicionar Coordinator + Supervisor na flag can_delete_drivers
DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;
CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
          ('Coordinator', 'Manager', 'Director', 'Admin Master')
        OR (
          (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Fleet Analyst', 'Supervisor')
          AND (SELECT can_delete_drivers FROM public.profiles WHERE id = auth.uid()) = true
        )
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );
