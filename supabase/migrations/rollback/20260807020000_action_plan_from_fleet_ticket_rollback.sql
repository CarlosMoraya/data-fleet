-- Rollback de 20260807020000_action_plan_from_fleet_ticket.sql
-- ⚠️ Só é seguro se nenhum plano de ação com origem em chamado existir.
--    Verifique antes:
--    SELECT count(*) FROM public.action_plans WHERE fleet_ticket_id IS NOT NULL;
--    Se retornar > 0, decidir o destino dessas linhas antes de prosseguir.

DROP INDEX IF EXISTS public.idx_action_plans_fleet_ticket;

ALTER TABLE public.action_plans
  DROP CONSTRAINT IF EXISTS action_plans_origin_check;

ALTER TABLE public.action_plans
  DROP COLUMN IF EXISTS fleet_ticket_id;

ALTER TABLE public.action_plans
  ALTER COLUMN checklist_id SET NOT NULL;
