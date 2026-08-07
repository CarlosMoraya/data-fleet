-- ============================================================
-- MIGRATION: action_plan_from_fleet_ticket
-- Descrição: permite que action_plans tenha origem em fleet_tickets
--            além de checklists, com exclusividade garantida por CHECK.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Migration puramente aditiva: nenhuma linha existente é alterada,
--    nenhuma policy RLS é modificada, nenhum backfill é necessário.
--    Todo plano legado tem checklist_id preenchido e fleet_ticket_id
--    NULL, satisfazendo o CHECK no momento da criação.
-- ============================================================

ALTER TABLE public.action_plans
  ALTER COLUMN checklist_id DROP NOT NULL;

ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS fleet_ticket_id UUID
    REFERENCES public.fleet_tickets(id) ON DELETE SET NULL;

ALTER TABLE public.action_plans
  DROP CONSTRAINT IF EXISTS action_plans_origin_check;

ALTER TABLE public.action_plans
  ADD CONSTRAINT action_plans_origin_check
  CHECK (num_nonnulls(checklist_id, fleet_ticket_id) = 1);

CREATE INDEX IF NOT EXISTS idx_action_plans_fleet_ticket
  ON public.action_plans(fleet_ticket_id)
  WHERE fleet_ticket_id IS NOT NULL;
