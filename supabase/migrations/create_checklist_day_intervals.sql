-- ============================================================
-- MIGRATION: create_checklist_day_intervals
-- Data: 2026-03-19
-- Descrição: Tabela para configurar intervalo em dias entre
--            checklists consecutivos de Rotina e Segurança
--            por cliente. Uma linha por cliente.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD SQL EDITOR
-- ============================================================

CREATE TABLE public.checklist_day_intervals (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id              UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rotina_day_interval    INTEGER NULL,
  seguranca_day_interval INTEGER NULL,
  updated_at             TIMESTAMPTZ DEFAULT now(),
  updated_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT checklist_day_intervals_client_id_unique UNIQUE(client_id)
);

CREATE INDEX idx_cdi_client_id ON public.checklist_day_intervals(client_id);

ALTER TABLE public.checklist_day_intervals ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant(3)+ do próprio tenant OU Admin Master
CREATE POLICY "cdi_select" ON public.checklist_day_intervals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_day_intervals.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- INSERT: Fleet Assistant(3)+ do próprio tenant OU Admin Master
CREATE POLICY "cdi_insert" ON public.checklist_day_intervals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_day_intervals.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- UPDATE: Fleet Assistant(3)+ do próprio tenant OU Admin Master
CREATE POLICY "cdi_update" ON public.checklist_day_intervals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_day_intervals.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- DELETE: Manager(5)+ ou Admin Master
CREATE POLICY "cdi_delete" ON public.checklist_day_intervals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_day_intervals.client_id
            AND p.role IN ('Manager','Coordinator','Director')
          )
        )
    )
  );
