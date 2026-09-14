-- ROLLBACK de 20260914100000_yard_auditor_action_plan_responsible.sql
-- Remove apenas o que a migration criou. As 4 policies originais não foram tocadas.
DROP TRIGGER IF EXISTS trg_enforce_yard_auditor_action_plan_update ON public.action_plans;
DROP FUNCTION IF EXISTS public.fn_enforce_yard_auditor_action_plan_update();
DROP FUNCTION IF EXISTS public.get_yard_auditor_action_plan_labels(UUID[]);
DROP POLICY IF EXISTS "action_plans_update_yard_auditor_responsible" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans_select_yard_auditor_responsible" ON public.action_plans;
NOTIFY pgrst, 'reload schema';
