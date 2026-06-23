-- ── 1. warranty_revision_plans ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranty_revision_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT NULL,
  model TEXT NULL,
  model_year_from INTEGER NULL,
  model_year_to INTEGER NULL,
  category TEXT NULL,
  shipper_id UUID NULL REFERENCES shippers(id) ON DELETE SET NULL,
  operational_unit_id UUID NULL REFERENCES operational_units(id) ON DELETE SET NULL,
  is_adhoc BOOLEAN NOT NULL DEFAULT false,   -- true = criado por placa (não reutilizável)
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. warranty_revision_plan_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranty_revision_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES warranty_revision_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,                 -- 1, 2, 3...
  label TEXT NOT NULL,                       -- ex: "1ª revisão"
  target_km INTEGER NOT NULL,                -- KM absoluto alvo (ex: 10000)
  km_tolerance INTEGER NOT NULL DEFAULT 0,   -- janela de KM para "a vencer"/"vencida"
  months_from_acquisition INTEGER NULL,      -- prazo por tempo (opcional)
  days_tolerance INTEGER NOT NULL DEFAULT 0, -- janela de dias
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, sequence)
);

-- ── 3. vehicle_warranty_revision_assignments ────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_warranty_revision_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES warranty_revision_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  start_km INTEGER NULL,
  start_date DATE NULL,
  finished_reason TEXT NULL CHECK (finished_reason IN
    ('warranty_expired','km_limit_reached','manual_finish','all_done_confirmed','vehicle_out_of_warranty')),
  finished_by UUID NULL REFERENCES profiles(id),
  finished_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No máximo 1 assignment ATIVO por veículo:
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment_per_vehicle
  ON vehicle_warranty_revision_assignments (vehicle_id)
  WHERE status = 'active';

-- ── 4. vehicle_warranty_revision_events ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_warranty_revision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES vehicle_warranty_revision_assignments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  plan_item_id UUID NULL REFERENCES warranty_revision_plan_items(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  label TEXT NOT NULL,
  target_km INTEGER NOT NULL,                -- snapshot (ajustável por veículo)
  target_date DATE NULL,                     -- snapshot calculado de acquisition_date + months
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','presumed_completed','completed')),
  executed_km INTEGER NULL,
  executed_date DATE NULL,
  maintenance_order_id UUID NULL REFERENCES maintenance_orders(id) ON DELETE SET NULL,
  evidence_url TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wre_vehicle_status
  ON vehicle_warranty_revision_events (vehicle_id, status, sequence);

-- ── 5. Vínculo na OS (tipo da OS permanece intacto) ─────────────────────────
ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS warranty_revision_event_id UUID NULL
  REFERENCES vehicle_warranty_revision_events(id) ON DELETE SET NULL;

-- ── 6. RLS (subqueries inline; portável dev/prod) ───────────────────────────

-- warranty_revision_plans
ALTER TABLE warranty_revision_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_revision_plans_select_tenant" ON warranty_revision_plans FOR SELECT USING (
  client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
);
CREATE POLICY "warranty_revision_plans_write_managers" ON warranty_revision_plans FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
) WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
);

-- warranty_revision_plan_items
ALTER TABLE warranty_revision_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_revision_plan_items_select_tenant" ON warranty_revision_plan_items FOR SELECT USING (
  client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
);
CREATE POLICY "warranty_revision_plan_items_write_managers" ON warranty_revision_plan_items FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
) WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
);

-- vehicle_warranty_revision_assignments
ALTER TABLE vehicle_warranty_revision_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_warranty_revision_assignments_select_tenant" ON vehicle_warranty_revision_assignments FOR SELECT USING (
  client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
);
CREATE POLICY "vehicle_warranty_revision_assignments_write_managers" ON vehicle_warranty_revision_assignments FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
) WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
);

-- vehicle_warranty_revision_events
ALTER TABLE vehicle_warranty_revision_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_warranty_revision_events_select_tenant" ON vehicle_warranty_revision_events FOR SELECT USING (
  client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
);
CREATE POLICY "vehicle_warranty_revision_events_write_managers" ON vehicle_warranty_revision_events FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
) WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('Coordinator','Manager','Director','Admin Master')
  AND (
    client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
  )
);

-- ── 7. Trigger: concluir OS marca a revisão vinculada como completed ─────────
CREATE OR REPLACE FUNCTION fn_complete_warranty_revision_on_os()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Concluído'
     AND NEW.warranty_revision_event_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'Concluído') THEN
    UPDATE vehicle_warranty_revision_events
      SET status = 'completed',
          executed_km = COALESCE(NEW.current_km, executed_km),
          executed_date = COALESCE(NEW.actual_exit_date, CURRENT_DATE),
          maintenance_order_id = NEW.id,
          updated_at = now()
    WHERE id = NEW.warranty_revision_event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_complete_warranty_revision ON maintenance_orders;
CREATE TRIGGER trg_complete_warranty_revision
  AFTER UPDATE ON maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION fn_complete_warranty_revision_on_os();

NOTIFY pgrst, 'reload schema';