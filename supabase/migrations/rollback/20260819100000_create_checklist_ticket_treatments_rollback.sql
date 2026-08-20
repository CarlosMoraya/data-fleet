DROP TRIGGER IF EXISTS trg_block_checklist_plan_when_treated_by_ticket
  ON public.action_plans;
DROP TRIGGER IF EXISTS trg_block_treatment_when_checklist_has_plan
  ON public.checklist_ticket_treatments;

DROP FUNCTION IF EXISTS public.fn_block_checklist_plan_when_treated_by_ticket();
DROP FUNCTION IF EXISTS public.fn_block_treatment_when_checklist_has_plan();

DROP TABLE IF EXISTS public.checklist_ticket_treatments CASCADE;
