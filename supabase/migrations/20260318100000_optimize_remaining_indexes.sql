-- ============================================================================
-- Migration: Indexes complementares para performance
-- Data: 2026-03-18
-- Complementa: 20260318080000_optimize_performance_indexes.sql
-- ============================================================================

-- driver_field_settings: RLS policies fazem subquery em client_id
CREATE INDEX IF NOT EXISTS idx_driver_field_settings_client_id
  ON public.driver_field_settings(client_id);

-- workshop_schedules: FK lookups frequentes em queries e auto-complete
CREATE INDEX IF NOT EXISTS ws_schedules_workshop_idx
  ON public.workshop_schedules(workshop_id);

CREATE INDEX IF NOT EXISTS ws_schedules_checklist_idx
  ON public.workshop_schedules(checklist_id);

-- action_plans: filtragem por reporter (usado em RLS e UI)
CREATE INDEX IF NOT EXISTS idx_action_plans_reported_by
  ON public.action_plans(reported_by);

-- checklists: composite para queries RLS de Driver (vehicle + filled_by)
CREATE INDEX IF NOT EXISTS idx_checklists_vehicle_filled_by
  ON public.checklists(vehicle_id, filled_by);
