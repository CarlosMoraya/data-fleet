-- ─── Tire Inspections ─────────────────────────────────────────────────────────
-- Módulo de inspeção de pneus pneu-a-pneu, separado dos checklists regulares.
-- Respostas são geradas dinamicamente a partir do axle_config do veículo.

-- 1. Tabela principal de inspeções
CREATE TABLE public.tire_inspections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id            UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  filled_by             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress','completed')),
  odometer_km           INTEGER,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  device_info           TEXT,
  notes                 TEXT,
  axle_config_snapshot  JSONB NOT NULL,
  steps_count_snapshot  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_tire_inspections_client_id    ON public.tire_inspections (client_id);
CREATE INDEX idx_tire_inspections_vehicle_id   ON public.tire_inspections (vehicle_id);
CREATE INDEX idx_tire_inspections_filled_by    ON public.tire_inspections (filled_by);
CREATE INDEX idx_tire_inspections_vehicle_completed
  ON public.tire_inspections (vehicle_id, completed_at DESC);

-- 2. Tabela de respostas por posição
CREATE TABLE public.tire_inspection_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   UUID NOT NULL REFERENCES public.tire_inspections(id) ON DELETE CASCADE,
  tire_id         UUID REFERENCES public.tires(id) ON DELETE SET NULL,
  position_code   TEXT NOT NULL,
  position_label  TEXT NOT NULL,
  dot             TEXT,
  fire_marking    TEXT,
  manufacturer    TEXT NOT NULL,
  brand           TEXT NOT NULL,
  photo_url       TEXT NOT NULL,
  photo_timestamp TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('conforme','nao_conforme')),
  observation     TEXT,
  responded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, position_code)
);

CREATE INDEX idx_tire_inspection_responses_inspection_id
  ON public.tire_inspection_responses (inspection_id);

-- 3. Estender checklist_day_intervals com intervalo de pneus (mín 7 dias)
ALTER TABLE public.checklist_day_intervals
  ADD COLUMN IF NOT EXISTS pneus_day_interval INTEGER NOT NULL DEFAULT 7;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.tire_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_inspection_responses ENABLE ROW LEVEL SECURITY;

-- tire_inspections: Driver/Auditor veem próprias, Fleet Assistant+ veem todo o tenant, Admin Master vê tudo

CREATE POLICY "tire_inspections_select" ON public.tire_inspections
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (auth.jwt() ->> 'role') IN ('Manager','Fleet Assistant','Fleet Analyst','Supervisor')
        OR filled_by = auth.uid()
      )
    )
  );

CREATE POLICY "tire_inspections_insert" ON public.tire_inspections
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'role') = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (auth.jwt() ->> 'role') IN ('Driver','Auditor','Fleet Assistant','Manager','Supervisor')
    )
  );

CREATE POLICY "tire_inspections_update" ON public.tire_inspections
  FOR UPDATE USING (
    (auth.jwt() ->> 'role') = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        filled_by = auth.uid()
        OR (auth.jwt() ->> 'role') IN ('Manager','Fleet Assistant')
      )
    )
  );

CREATE POLICY "tire_inspections_delete" ON public.tire_inspections
  FOR DELETE USING (
    (auth.jwt() ->> 'role') = 'Admin Master'
  );

-- tire_inspection_responses: acesso via join com tire_inspections

CREATE POLICY "tire_inspection_responses_select" ON public.tire_inspection_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tire_inspections ti
      WHERE ti.id = inspection_id
        AND (
          (auth.jwt() ->> 'role') = 'Admin Master'
          OR (
            ti.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (
              (auth.jwt() ->> 'role') IN ('Manager','Fleet Assistant','Fleet Analyst','Supervisor')
              OR ti.filled_by = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "tire_inspection_responses_insert" ON public.tire_inspection_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tire_inspections ti
      WHERE ti.id = inspection_id
        AND (
          (auth.jwt() ->> 'role') = 'Admin Master'
          OR (
            ti.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (ti.filled_by = auth.uid() OR (auth.jwt() ->> 'role') IN ('Manager','Fleet Assistant'))
          )
        )
    )
  );

CREATE POLICY "tire_inspection_responses_update" ON public.tire_inspection_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tire_inspections ti
      WHERE ti.id = inspection_id
        AND (
          (auth.jwt() ->> 'role') = 'Admin Master'
          OR (
            ti.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (ti.filled_by = auth.uid() OR (auth.jwt() ->> 'role') IN ('Manager','Fleet Assistant'))
          )
        )
    )
  );

CREATE POLICY "tire_inspection_responses_delete" ON public.tire_inspection_responses
  FOR DELETE USING (
    (auth.jwt() ->> 'role') = 'Admin Master'
  );
