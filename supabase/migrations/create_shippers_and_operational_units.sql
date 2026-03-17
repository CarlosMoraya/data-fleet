-- ─── 1. Tabela shippers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shippers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  cnpj           TEXT,
  phone          TEXT,
  email          TEXT,
  contact_person TEXT,
  notes          TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, cnpj)
);
-- UNIQUE(client_id, cnpj) não conflita com NULLs no PostgreSQL — OK para cnpj opcional.

-- ─── 2. Tabela operational_units ────────────────────────────
CREATE TABLE IF NOT EXISTS public.operational_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shipper_id  UUID NOT NULL REFERENCES public.shippers(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  code        TEXT,
  city        TEXT,
  state       TEXT,
  notes       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Partial unique para code nullable (único por cliente)
CREATE UNIQUE INDEX IF NOT EXISTS operational_units_client_code_unique
  ON public.operational_units (client_id, code)
  WHERE code IS NOT NULL;
-- ON DELETE RESTRICT: não permite deletar embarcador que ainda tem unidades vinculadas.

-- ─── 3. FK columns em vehicles ──────────────────────────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS shipper_id          UUID REFERENCES public.shippers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operational_unit_id UUID REFERENCES public.operational_units(id) ON DELETE SET NULL;

-- ─── 4. RLS — shippers ──────────────────────────────────────
ALTER TABLE public.shippers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shippers_select" ON public.shippers FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
       OR role = 'Admin Master'
  )
);
CREATE POLICY "shippers_insert" ON public.shippers FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
       OR role = 'Admin Master'
  )
);
CREATE POLICY "shippers_update" ON public.shippers FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN ('Fleet Analyst','Manager','Director'))
       OR role = 'Admin Master'
  )
);
CREATE POLICY "shippers_delete" ON public.shippers FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = shippers.client_id AND role IN ('Manager','Director'))
       OR role = 'Admin Master'
  )
);

-- ─── 5. RLS — operational_units ─────────────────────────────
ALTER TABLE public.operational_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operational_units_select" ON public.operational_units FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
       OR role = 'Admin Master'
  )
);
CREATE POLICY "operational_units_insert" ON public.operational_units FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
       OR role = 'Admin Master'
  )
);
CREATE POLICY "operational_units_update" ON public.operational_units FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN ('Fleet Analyst','Manager','Director'))
       OR role = 'Admin Master'
  )
);
CREATE POLICY "operational_units_delete" ON public.operational_units FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE (client_id = operational_units.client_id AND role IN ('Manager','Director'))
       OR role = 'Admin Master'
  )
);

-- ─── 6. Índices ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS shippers_client_id_idx          ON public.shippers (client_id);
CREATE INDEX IF NOT EXISTS operational_units_client_id_idx ON public.operational_units (client_id);
CREATE INDEX IF NOT EXISTS operational_units_shipper_id_idx ON public.operational_units (shipper_id);
CREATE INDEX IF NOT EXISTS vehicles_shipper_id_idx         ON public.vehicles (shipper_id);
CREATE INDEX IF NOT EXISTS vehicles_op_unit_id_idx         ON public.vehicles (operational_unit_id);
