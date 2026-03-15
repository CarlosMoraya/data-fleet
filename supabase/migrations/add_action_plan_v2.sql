-- Migration: Action Plan v2
-- Remove allowDriverActions/allowAuditorActions from checklist_templates
ALTER TABLE public.checklist_templates
  DROP COLUMN IF EXISTS allow_driver_actions,
  DROP COLUMN IF EXISTS allow_auditor_actions;

-- Add new columns to action_plans
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conclusion_evidence_url TEXT;

-- Update status CHECK constraint to include 'awaiting_conclusion'
ALTER TABLE public.action_plans
  DROP CONSTRAINT IF EXISTS action_plans_status_check;

ALTER TABLE public.action_plans
  ADD CONSTRAINT action_plans_status_check
  CHECK (status IN ('pending', 'in_progress', 'awaiting_conclusion', 'completed', 'cancelled'));

-- Update INSERT RLS: only Fleet Analyst+ (rank >= 4) or Admin Master can create action plans
DROP POLICY IF EXISTS "action_plans_insert" ON public.action_plans;

CREATE POLICY "action_plans_insert" ON public.action_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Analyst', 'Manager', 'Director')
          )
        )
    )
  );

-- Update UPDATE RLS: Fleet Assistant+ can update (claim/execute), Analyst+ can approve
-- Keep existing Fleet Assistant+ policy but ensure it covers the new status transitions
DROP POLICY IF EXISTS "action_plans_update" ON public.action_plans;

CREATE POLICY "action_plans_update" ON public.action_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director')
          )
        )
    )
  );
