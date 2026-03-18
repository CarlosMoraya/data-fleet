-- ============================================================
-- MIGRATION: create_workshop_schedules
-- Descrição: Cria tabela de agendamentos de oficina com RLS,
--            suporte a auto-conclusão via checklist e acesso
--            do motorista para visualizar seus próprios agendamentos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workshop_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id       UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  workshop_id      UUID NOT NULL REFERENCES public.workshops(id) ON DELETE RESTRICT,
  scheduled_date   DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  completed_at     TIMESTAMPTZ,
  checklist_id     UUID REFERENCES public.checklists(id) ON DELETE SET NULL,
  notes            TEXT,
  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS ws_schedules_client_idx
  ON public.workshop_schedules (client_id);

CREATE INDEX IF NOT EXISTS ws_schedules_vehicle_status_idx
  ON public.workshop_schedules (vehicle_id, status);

-- Índice composto para lookup de auto-complete (ChecklistFill)
CREATE INDEX IF NOT EXISTS ws_schedules_vehicle_workshop_status_idx
  ON public.workshop_schedules (vehicle_id, workshop_id, status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.workshop_schedules ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   - Fleet Assistant+ (rank 3+): vê todos do tenant
--   - Driver: vê apenas agendamentos do veículo associado a ele
--   - Admin Master: vê tudo
CREATE POLICY "ws_schedules_select" ON public.workshop_schedules
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE
        -- Fleet Assistant+ do mesmo tenant
        (p.client_id = workshop_schedules.client_id
          AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
        -- Driver: apenas se o veículo agendado for o veículo do motorista
        OR (
          p.client_id = workshop_schedules.client_id
          AND p.role = 'Driver'
          AND EXISTS (
            SELECT 1 FROM public.drivers d
            JOIN public.vehicles v ON v.driver_id = d.id AND v.client_id = d.client_id
            WHERE d.profile_id = auth.uid()
              AND v.id = workshop_schedules.vehicle_id
          )
        )
    )
  );

-- INSERT: Fleet Assistant+ (rank 3+) + Admin Master
CREATE POLICY "ws_schedules_insert" ON public.workshop_schedules
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE
        (p.client_id = workshop_schedules.client_id
          AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
    )
  );

-- UPDATE: Fleet Assistant+ (rank 3+) + Admin Master + Driver (veículo próprio, para auto-complete)
CREATE POLICY "ws_schedules_update" ON public.workshop_schedules
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE
        (p.client_id = workshop_schedules.client_id
          AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
        OR (
          p.client_id = workshop_schedules.client_id
          AND p.role = 'Driver'
          AND EXISTS (
            SELECT 1 FROM public.drivers d
            JOIN public.vehicles v ON v.driver_id = d.id AND v.client_id = d.client_id
            WHERE d.profile_id = auth.uid()
              AND v.id = workshop_schedules.vehicle_id
          )
        )
    )
  );

-- DELETE: Manager+ (rank 5+) + Admin Master
CREATE POLICY "ws_schedules_delete" ON public.workshop_schedules
  FOR DELETE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      WHERE
        (p.client_id = workshop_schedules.client_id
          AND p.role IN ('Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
    )
  );
