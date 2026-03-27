-- ============================================================
-- Migration: Adiciona Supervisor e Coordinator às RLS policies
-- que os excluíam incorretamente.
-- Tabelas afetadas: drivers, driver_field_settings (SELECT),
--                  shippers, operational_units, workshops
-- Também atualiza role_rank() para refletir os novos ranks.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD
-- ============================================================

-- ── Atualiza role_rank() para refletir hierarquia atual ──────────────────────
CREATE OR REPLACE FUNCTION public.role_rank(role_name TEXT) RETURNS INT AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'Driver'          THEN 1
    WHEN 'Workshop'        THEN 1
    WHEN 'Yard Auditor'    THEN 2
    WHEN 'Fleet Assistant' THEN 3
    WHEN 'Fleet Analyst'   THEN 4
    WHEN 'Supervisor'      THEN 5
    WHEN 'Coordinator'     THEN 6
    WHEN 'Manager'         THEN 7
    WHEN 'Director'        THEN 8
    WHEN 'Admin Master'    THEN 9
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- ============================================================
-- DRIVERS
-- ============================================================

DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Coordinator', 'Manager', 'Director', 'Admin Master')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

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

-- ── driver_field_settings: SELECT (Fleet Assistant+) ────────────────────────
DROP POLICY IF EXISTS "dfs_select" ON public.driver_field_settings;
CREATE POLICY "dfs_select" ON public.driver_field_settings
  FOR SELECT USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Coordinator', 'Manager', 'Director', 'Admin Master')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- ============================================================
-- SHIPPERS
-- ============================================================

DROP POLICY IF EXISTS "shippers_select" ON public.shippers;
CREATE POLICY "shippers_select" ON public.shippers FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN
      ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

DROP POLICY IF EXISTS "shippers_insert" ON public.shippers;
CREATE POLICY "shippers_insert" ON public.shippers FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN
      ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

DROP POLICY IF EXISTS "shippers_update" ON public.shippers;
CREATE POLICY "shippers_update" ON public.shippers FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN
      ('Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

DROP POLICY IF EXISTS "shippers_delete" ON public.shippers;
CREATE POLICY "shippers_delete" ON public.shippers FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN
      ('Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

-- ============================================================
-- OPERATIONAL UNITS
-- ============================================================

DROP POLICY IF EXISTS "operational_units_select" ON public.operational_units;
CREATE POLICY "operational_units_select" ON public.operational_units FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN
      ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

DROP POLICY IF EXISTS "operational_units_insert" ON public.operational_units;
CREATE POLICY "operational_units_insert" ON public.operational_units FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN
      ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

DROP POLICY IF EXISTS "operational_units_update" ON public.operational_units;
CREATE POLICY "operational_units_update" ON public.operational_units FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN
      ('Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

DROP POLICY IF EXISTS "operational_units_delete" ON public.operational_units;
CREATE POLICY "operational_units_delete" ON public.operational_units FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN
      ('Coordinator','Manager','Director'))
       OR role = 'Admin Master'
  )
);

-- ============================================================
-- WORKSHOPS
-- ============================================================

DROP POLICY IF EXISTS "workshops_select" ON public.workshops;
CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN
          ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

DROP POLICY IF EXISTS "workshops_insert" ON public.workshops;
CREATE POLICY "workshops_insert" ON public.workshops
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN
          ('Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

DROP POLICY IF EXISTS "workshops_update" ON public.workshops;
CREATE POLICY "workshops_update" ON public.workshops
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN
          ('Fleet Analyst','Supervisor','Coordinator','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

DROP POLICY IF EXISTS "workshops_delete" ON public.workshops;
CREATE POLICY "workshops_delete" ON public.workshops
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Coordinator','Manager','Director'))
        OR role = 'Admin Master'
        OR (
          client_id = workshops.client_id
          AND role IN ('Fleet Analyst', 'Supervisor')
          AND can_delete_workshops = true
        )
      )
    )
  );
