-- ============================================================
-- MIGRATION: create_vehicle_km_intervals
-- Data: 2026-03-18
-- Descrição: Tabela para configurar km máximo entre revisões
--            por veículo. Gravação por Fleet Assistant+,
--            em tabela separada de vehicles (que exige Analyst+).
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD SQL EDITOR
-- ============================================================

CREATE TABLE public.vehicle_km_intervals (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id  UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  km_interval INTEGER NULL,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT vehicle_km_intervals_vehicle_id_unique UNIQUE(vehicle_id)
);

CREATE INDEX idx_vki_client_id  ON public.vehicle_km_intervals(client_id);
CREATE INDEX idx_vki_vehicle_id ON public.vehicle_km_intervals(vehicle_id);

ALTER TABLE public.vehicle_km_intervals ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant(3)+ do próprio tenant OU Admin Master
CREATE POLICY "vki_select" ON public.vehicle_km_intervals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = vehicle_km_intervals.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- INSERT: Fleet Assistant(3)+ do próprio tenant OU Admin Master
CREATE POLICY "vki_insert" ON public.vehicle_km_intervals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = vehicle_km_intervals.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- UPDATE: Fleet Assistant(3)+ do próprio tenant OU Admin Master
CREATE POLICY "vki_update" ON public.vehicle_km_intervals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = vehicle_km_intervals.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- DELETE: Manager(5)+ ou Admin Master
CREATE POLICY "vki_delete" ON public.vehicle_km_intervals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = vehicle_km_intervals.client_id
            AND p.role IN ('Manager','Coordinator','Director')
          )
        )
    )
  );
