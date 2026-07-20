-- 1.1 — Colunas de auditoria de divergência de vínculo (checklists e tire_inspections)

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS vehicle_link_divergence_reasons TEXT[] NULL,
  ADD COLUMN IF NOT EXISTS vehicle_link_assigned_driver_id UUID NULL REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_link_executor_vehicle_id UUID NULL REFERENCES public.vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.tire_inspections
  ADD COLUMN IF NOT EXISTS vehicle_link_divergence_reasons TEXT[] NULL,
  ADD COLUMN IF NOT EXISTS vehicle_link_assigned_driver_id UUID NULL REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_link_executor_vehicle_id UUID NULL REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklists_vehicle_link_divergence
  ON public.checklists (client_id)
  WHERE vehicle_link_divergence_reasons IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tire_inspections_vehicle_link_divergence
  ON public.tire_inspections (client_id)
  WHERE vehicle_link_divergence_reasons IS NOT NULL;

-- 1.2 — Flag de bloqueio por tenant

ALTER TABLE public.checklist_day_intervals
  ADD COLUMN IF NOT EXISTS enforce_driver_vehicle_link BOOLEAN NOT NULL DEFAULT false;

-- 1.3 — public.evaluate_vehicle_link_divergence

CREATE OR REPLACE FUNCTION public.evaluate_vehicle_link_divergence(
  p_vehicle_id UUID,
  p_profile_id UUID
)
RETURNS TABLE(
  reasons TEXT[],
  assigned_driver_id UUID,
  executor_vehicle_id UUID,
  executor_vehicle_plate TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_client_id UUID;
  v_vehicle_client_id UUID;
  v_assigned_driver_id UUID;
  v_executor_driver_id UUID;
  v_executor_vehicle_id UUID;
  v_executor_vehicle_plate TEXT;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.profiles
  WHERE id = p_profile_id;

  IF v_client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT v.client_id, v.driver_id
  INTO v_vehicle_client_id, v_assigned_driver_id
  FROM public.vehicles v
  WHERE v.id = p_vehicle_id;

  IF v_vehicle_client_id IS NULL OR v_vehicle_client_id <> v_client_id THEN
    RAISE EXCEPTION 'Veículo fora do tenant.';
  END IF;

  SELECT d.id INTO v_executor_driver_id
  FROM public.drivers d
  WHERE d.profile_id = p_profile_id
    AND d.client_id = v_client_id;

  SELECT v.id, v.license_plate
  INTO v_executor_vehicle_id, v_executor_vehicle_plate
  FROM public.vehicles v
  WHERE v.driver_id = v_executor_driver_id
    AND v.client_id = v_client_id;

  IF v_assigned_driver_id IS NOT NULL AND v_assigned_driver_id IS DISTINCT FROM v_executor_driver_id THEN
    v_reasons := array_append(v_reasons, 'other_driver_assigned');
  END IF;

  IF v_executor_vehicle_id IS NOT NULL AND v_executor_vehicle_id <> p_vehicle_id THEN
    v_reasons := array_append(v_reasons, 'executor_has_other_vehicle');
  END IF;

  IF array_length(v_reasons, 1) IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT[], NULL::UUID, NULL::UUID, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT v_reasons, v_assigned_driver_id, v_executor_vehicle_id, v_executor_vehicle_plate;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_vehicle_link_divergence(uuid, uuid) TO authenticated;

-- 1.4 — public.stamp_vehicle_link_divergence (trigger function)

CREATE OR REPLACE FUNCTION public.stamp_vehicle_link_divergence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filler_role TEXT;
  v_reasons TEXT[];
  v_assigned_driver_id UUID;
  v_executor_vehicle_id UUID;
  v_executor_vehicle_plate TEXT;
  v_enforce BOOLEAN;
BEGIN
  IF NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_filler_role
  FROM public.profiles
  WHERE id = NEW.filled_by;

  IF v_filler_role IS DISTINCT FROM 'Driver' THEN
    RETURN NEW;
  END IF;

  SELECT reasons, assigned_driver_id, executor_vehicle_id, executor_vehicle_plate
  INTO v_reasons, v_assigned_driver_id, v_executor_vehicle_id, v_executor_vehicle_plate
  FROM public.evaluate_vehicle_link_divergence(NEW.vehicle_id, NEW.filled_by);

  NEW.vehicle_link_divergence_reasons := v_reasons;
  NEW.vehicle_link_assigned_driver_id := v_assigned_driver_id;
  NEW.vehicle_link_executor_vehicle_id := v_executor_vehicle_id;

  IF v_reasons IS NOT NULL THEN
    SELECT enforce_driver_vehicle_link INTO v_enforce
    FROM public.checklist_day_intervals
    WHERE client_id = NEW.client_id;

    IF COALESCE(v_enforce, false) THEN
      RAISE EXCEPTION 'VEHICLE_LINK_DIVERGENCE_BLOCKED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_vehicle_link_divergence ON public.checklists;
CREATE TRIGGER trg_stamp_vehicle_link_divergence
  BEFORE INSERT ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.stamp_vehicle_link_divergence();

DROP TRIGGER IF EXISTS trg_stamp_vehicle_link_divergence ON public.tire_inspections;
CREATE TRIGGER trg_stamp_vehicle_link_divergence
  BEFORE INSERT ON public.tire_inspections
  FOR EACH ROW EXECUTE FUNCTION public.stamp_vehicle_link_divergence();

-- 1.5 — public.list_vehicles_for_checklist_selection

CREATE OR REPLACE FUNCTION public.list_vehicles_for_checklist_selection()
RETURNS TABLE(
  id UUID,
  license_plate TEXT,
  category TEXT,
  status TEXT,
  is_assigned_to_me BOOLEAN,
  has_other_driver BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_client_id UUID;
  v_role TEXT;
  v_my_driver_id UUID;
BEGIN
  SELECT p.client_id, p.role INTO v_client_id, v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role <> 'Driver' OR v_client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT d.id INTO v_my_driver_id
  FROM public.drivers d
  WHERE d.profile_id = auth.uid()
    AND d.client_id = v_client_id;

  RETURN QUERY
  SELECT
    v.id,
    v.license_plate,
    v.category,
    v.status,
    (v_my_driver_id IS NOT NULL AND v.driver_id IS NOT DISTINCT FROM v_my_driver_id) AS is_assigned_to_me,
    (v.driver_id IS NOT NULL AND v.driver_id IS DISTINCT FROM v_my_driver_id) AS has_other_driver
  FROM public.vehicles v
  WHERE v.client_id = v_client_id
    AND v.active = true
  ORDER BY (v_my_driver_id IS NOT NULL AND v.driver_id IS NOT DISTINCT FROM v_my_driver_id) DESC, v.license_plate ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_vehicles_for_checklist_selection() TO authenticated;

-- 1.6 — public.get_vehicle_tire_inspection_config

CREATE OR REPLACE FUNCTION public.get_vehicle_tire_inspection_config(p_vehicle_id UUID)
RETURNS TABLE(
  axle_config JSONB,
  steps_count INTEGER,
  vehicle_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_client_id UUID;
  v_vehicle_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT v.client_id INTO v_vehicle_client_id
  FROM public.vehicles v
  WHERE v.id = p_vehicle_id;

  IF v_vehicle_client_id IS NULL OR v_client_id IS NULL OR v_vehicle_client_id <> v_client_id THEN
    RAISE EXCEPTION 'Veículo fora do tenant.';
  END IF;

  RETURN QUERY
  SELECT v.axle_config, v.steps_count, v.type
  FROM public.vehicles v
  WHERE v.id = p_vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vehicle_tire_inspection_config(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
