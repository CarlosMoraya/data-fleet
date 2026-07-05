CREATE TABLE IF NOT EXISTS public.third_party_tractor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  plate text NOT NULL,
  crlv_upload text,
  crlv_expiration_date date,
  antt text,
  gr_upload text,
  gr_expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, plate)
);

CREATE INDEX IF NOT EXISTS idx_third_party_tractor_client_plate
  ON public.third_party_tractor (client_id, plate);

CREATE TABLE IF NOT EXISTS public.third_party_driver (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  cnh text,
  cnh_expiration_date date,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_third_party_driver_client_name
  ON public.third_party_driver (client_id, name);

CREATE TABLE IF NOT EXISTS public.vehicle_couplings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  trailer_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  tractor_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  tractor_plate text,
  tractor_driver_name text,
  third_party_tractor_id uuid REFERENCES public.third_party_tractor(id) ON DELETE SET NULL,
  third_party_driver_id uuid REFERENCES public.third_party_driver(id) ON DELETE SET NULL,
  coupled_at timestamptz NOT NULL DEFAULT now(),
  uncoupled_at timestamptz,
  coupled_latitude numeric,
  coupled_longitude numeric,
  uncoupled_latitude numeric,
  uncoupled_longitude numeric,
  odometer_coupled numeric,
  odometer_uncoupled numeric,
  distance_km numeric,
  coupling_checklist_id uuid REFERENCES public.checklists(id) ON DELETE SET NULL,
  uncoupling_checklist_id uuid REFERENCES public.checklists(id) ON DELETE SET NULL,
  filled_by uuid NOT NULL REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_couplings_tractor_identity_check
    CHECK (tractor_id IS NOT NULL OR btrim(coalesce(tractor_plate, '')) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_coupling_per_trailer
  ON public.vehicle_couplings (trailer_id)
  WHERE uncoupled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_couplings_trailer_id
  ON public.vehicle_couplings (trailer_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_couplings_tractor_id
  ON public.vehicle_couplings (tractor_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_couplings_client_id
  ON public.vehicle_couplings (client_id);

ALTER TABLE public.third_party_tractor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_party_driver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_couplings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS third_party_tractor_select ON public.third_party_tractor;
CREATE POLICY third_party_tractor_select ON public.third_party_tractor
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS third_party_tractor_insert ON public.third_party_tractor;
CREATE POLICY third_party_tractor_insert ON public.third_party_tractor
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS third_party_tractor_update ON public.third_party_tractor;
CREATE POLICY third_party_tractor_update ON public.third_party_tractor
  FOR UPDATE TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  )
  WITH CHECK (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS third_party_driver_select ON public.third_party_driver;
CREATE POLICY third_party_driver_select ON public.third_party_driver
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS third_party_driver_insert ON public.third_party_driver;
CREATE POLICY third_party_driver_insert ON public.third_party_driver
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS third_party_driver_update ON public.third_party_driver;
CREATE POLICY third_party_driver_update ON public.third_party_driver
  FOR UPDATE TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  )
  WITH CHECK (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS vehicle_couplings_select ON public.vehicle_couplings;
CREATE POLICY vehicle_couplings_select ON public.vehicle_couplings
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS vehicle_couplings_insert ON public.vehicle_couplings;
CREATE POLICY vehicle_couplings_insert ON public.vehicle_couplings
  FOR INSERT TO authenticated
  WITH CHECK (
    filled_by = auth.uid()
    AND (
      (
        client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
        )
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

DROP POLICY IF EXISTS vehicle_couplings_update ON public.vehicle_couplings;
CREATE POLICY vehicle_couplings_update ON public.vehicle_couplings
  FOR UPDATE TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  )
  WITH CHECK (
    filled_by = auth.uid()
    AND (
      (
        client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
        AND (
          (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
        )
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- DROP TABLE IF EXISTS public.vehicle_couplings CASCADE;
-- DROP TABLE IF EXISTS public.third_party_driver CASCADE;
-- DROP TABLE IF EXISTS public.third_party_tractor CASCADE;
-- NOTIFY pgrst, 'reload schema';
