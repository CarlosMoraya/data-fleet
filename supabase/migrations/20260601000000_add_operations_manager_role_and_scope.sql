-- ============================================================
-- MIGRATION: add_operations_manager_role_and_scope
-- Descrição: adiciona o perfil Operations Manager com escopo
-- por embarcador/base e leitura restrita por RLS.
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'Driver',
    'Yard Auditor',
    'Workshop',
    'Fleet Assistant',
    'Fleet Analyst',
    'Supervisor',
    'Operations Manager',
    'Coordinator',
    'Manager',
    'Director',
    'Admin Master'
  ));

CREATE OR REPLACE FUNCTION public.role_rank(role_name TEXT) RETURNS INT AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.profile_shipper_scopes (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipper_id UUID NOT NULL REFERENCES public.shippers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES public.profiles(id),
  PRIMARY KEY (profile_id, shipper_id)
);

CREATE TABLE IF NOT EXISTS public.profile_operational_unit_scopes (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operational_unit_id UUID NOT NULL REFERENCES public.operational_units(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES public.profiles(id),
  PRIMARY KEY (profile_id, operational_unit_id)
);

CREATE INDEX IF NOT EXISTS profile_shipper_scopes_client_id_idx
  ON public.profile_shipper_scopes (client_id);
CREATE INDEX IF NOT EXISTS profile_shipper_scopes_profile_id_idx
  ON public.profile_shipper_scopes (profile_id);
CREATE INDEX IF NOT EXISTS profile_shipper_scopes_shipper_id_idx
  ON public.profile_shipper_scopes (shipper_id);

CREATE INDEX IF NOT EXISTS profile_operational_unit_scopes_client_id_idx
  ON public.profile_operational_unit_scopes (client_id);
CREATE INDEX IF NOT EXISTS profile_operational_unit_scopes_profile_id_idx
  ON public.profile_operational_unit_scopes (profile_id);
CREATE INDEX IF NOT EXISTS profile_operational_unit_scopes_operational_unit_id_idx
  ON public.profile_operational_unit_scopes (operational_unit_id);

CREATE OR REPLACE FUNCTION public.is_operations_manager_profile(target_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_profile_id
      AND role = 'Operations Manager'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.operations_manager_has_shipper_scope(
  target_profile_id UUID,
  target_shipper_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_shipper_scopes
    WHERE profile_id = target_profile_id
      AND shipper_id = target_shipper_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.operations_manager_has_operational_unit_scope(
  target_profile_id UUID,
  target_operational_unit_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_operational_unit_scopes
    WHERE profile_id = target_profile_id
      AND operational_unit_id = target_operational_unit_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.operations_manager_can_access_vehicle(
  target_profile_id UUID,
  target_shipper_id UUID,
  target_operational_unit_id UUID
) RETURNS BOOLEAN AS $$
  SELECT
    target_shipper_id IS NOT NULL
    AND target_operational_unit_id IS NOT NULL
    AND public.operations_manager_has_shipper_scope(target_profile_id, target_shipper_id)
    AND public.operations_manager_has_operational_unit_scope(target_profile_id, target_operational_unit_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.operations_manager_can_access_vehicle_id(
  target_profile_id UUID,
  target_vehicle_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = target_vehicle_id
      AND v.shipper_id IS NOT NULL
      AND v.operational_unit_id IS NOT NULL
      AND public.operations_manager_has_shipper_scope(target_profile_id, v.shipper_id)
      AND public.operations_manager_has_operational_unit_scope(target_profile_id, v.operational_unit_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.validate_profile_shipper_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = NEW.profile_id;

  IF NOT FOUND OR v_profile.role <> 'Operations Manager' THEN
    RAISE EXCEPTION 'Somente perfis Operations Manager podem ter shipper scopes.';
  END IF;

  IF v_profile.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'client_id do escopo difere do client_id do perfil.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.shippers s
    WHERE s.id = NEW.shipper_id
      AND s.client_id = NEW.client_id
  ) THEN
    RAISE EXCEPTION 'shipper_id inválido para o client_id informado.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.validate_profile_operational_unit_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_unit public.operational_units%ROWTYPE;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = NEW.profile_id;

  IF NOT FOUND OR v_profile.role <> 'Operations Manager' THEN
    RAISE EXCEPTION 'Somente perfis Operations Manager podem ter operational unit scopes.';
  END IF;

  IF v_profile.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'client_id do escopo difere do client_id do perfil.';
  END IF;

  SELECT *
  INTO v_unit
  FROM public.operational_units
  WHERE id = NEW.operational_unit_id;

  IF NOT FOUND OR v_unit.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'operational_unit_id inválido para o client_id informado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profile_shipper_scopes pss
    WHERE pss.profile_id = NEW.profile_id
      AND pss.shipper_id = v_unit.shipper_id
  ) THEN
    RAISE EXCEPTION 'A base operacional deve pertencer a um embarcador associado ao perfil.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_profile_shipper_scope_trigger ON public.profile_shipper_scopes;
CREATE TRIGGER validate_profile_shipper_scope_trigger
  BEFORE INSERT OR UPDATE ON public.profile_shipper_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_shipper_scope();

DROP TRIGGER IF EXISTS validate_profile_operational_unit_scope_trigger ON public.profile_operational_unit_scopes;
CREATE TRIGGER validate_profile_operational_unit_scope_trigger
  BEFORE INSERT OR UPDATE ON public.profile_operational_unit_scopes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_operational_unit_scope();

CREATE OR REPLACE FUNCTION public.cleanup_operations_manager_scopes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> 'Operations Manager' THEN
    DELETE FROM public.profile_operational_unit_scopes WHERE profile_id = NEW.id;
    DELETE FROM public.profile_shipper_scopes WHERE profile_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_operations_manager_scopes_trigger ON public.profiles;
CREATE TRIGGER cleanup_operations_manager_scopes_trigger
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_operations_manager_scopes();

ALTER TABLE public.profile_shipper_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_operational_unit_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_shipper_scopes_manager_select" ON public.profile_shipper_scopes
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
    )
    OR (profile_id = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "profile_shipper_scopes_manager_insert" ON public.profile_shipper_scopes
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  );

CREATE POLICY "profile_shipper_scopes_manager_update" ON public.profile_shipper_scopes
  FOR UPDATE TO authenticated
  USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  )
  WITH CHECK (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  );

CREATE POLICY "profile_shipper_scopes_manager_delete" ON public.profile_shipper_scopes
  FOR DELETE TO authenticated
  USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  );

CREATE POLICY "profile_operational_unit_scopes_manager_select" ON public.profile_operational_unit_scopes
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
    )
    OR (profile_id = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "profile_operational_unit_scopes_manager_insert" ON public.profile_operational_unit_scopes
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  );

CREATE POLICY "profile_operational_unit_scopes_manager_update" ON public.profile_operational_unit_scopes
  FOR UPDATE TO authenticated
  USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  )
  WITH CHECK (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  );

CREATE POLICY "profile_operational_unit_scopes_manager_delete" ON public.profile_operational_unit_scopes
  FOR DELETE TO authenticated
  USING (
    client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Coordinator', 'Manager')
  );

DROP POLICY IF EXISTS "shippers_select" ON public.shippers;
CREATE POLICY "shippers_select" ON public.shippers FOR SELECT TO authenticated USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (
      client_id = shippers.client_id
      AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director')
    )
    OR role = 'Admin Master'
  )
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND public.operations_manager_has_shipper_scope(auth.uid(), shippers.id)
  )
);

DROP POLICY IF EXISTS "operational_units_select" ON public.operational_units;
CREATE POLICY "operational_units_select" ON public.operational_units FOR SELECT TO authenticated USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (
      client_id = operational_units.client_id
      AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director')
    )
    OR role = 'Admin Master'
  )
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND public.operations_manager_has_operational_unit_scope(auth.uid(), operational_units.id)
  )
);

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_tenant_select" ON public.vehicles;
DROP POLICY IF EXISTS "tenant_read_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Enable read for users based on client_id" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle(auth.uid(), shipper_id, operational_unit_id)
    )
  );

DROP POLICY IF EXISTS "ws_schedules_select" ON public.workshop_schedules;
CREATE POLICY "ws_schedules_select" ON public.workshop_schedules
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Driver'
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND vehicle_id IN (
        SELECT v.id
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.driver_id AND d.client_id = v.client_id
        WHERE d.profile_id = auth.uid()
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
  );

DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_orders;
CREATE POLICY "maintenance_select" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND workshop_id IN (
        SELECT id FROM public.workshops WHERE profile_id = auth.uid()
        UNION
        SELECT wp.legacy_workshop_id
        FROM public.workshop_partnerships wp
        JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
        WHERE wa.profile_id = auth.uid()
          AND wp.status = 'active'
          AND wp.legacy_workshop_id IS NOT NULL
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
  );

DROP POLICY IF EXISTS "budget_items_select" ON public.maintenance_budget_items;
CREATE POLICY "budget_items_select" ON public.maintenance_budget_items
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid()
            AND wp.status = 'active'
            AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND maintenance_order_id IN (
        SELECT mo.id
        FROM public.maintenance_orders mo
        JOIN public.vehicles v ON v.id = mo.vehicle_id
        WHERE public.operations_manager_can_access_vehicle(auth.uid(), v.shipper_id, v.operational_unit_id)
      )
    )
  );

DROP POLICY IF EXISTS "workshops_select" ON public.workshops;
CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN
          ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND (
        EXISTS (
          SELECT 1
          FROM public.workshop_schedules ws
          JOIN public.vehicles v ON v.id = ws.vehicle_id
          WHERE ws.workshop_id = workshops.id
            AND public.operations_manager_can_access_vehicle(auth.uid(), v.shipper_id, v.operational_unit_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.maintenance_orders mo
          JOIN public.vehicles v ON v.id = mo.vehicle_id
          WHERE mo.workshop_id = workshops.id
            AND public.operations_manager_can_access_vehicle(auth.uid(), v.shipper_id, v.operational_unit_id)
        )
      )
    )
  );
