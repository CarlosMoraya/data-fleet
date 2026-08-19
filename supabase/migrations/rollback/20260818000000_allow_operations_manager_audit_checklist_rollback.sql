DROP POLICY IF EXISTS "templates_select_operations_manager" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_items_select_operations_manager" ON public.checklist_items;
DROP POLICY IF EXISTS "checklists_select_operations_manager" ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert_operations_manager" ON public.checklists;
DROP POLICY IF EXISTS "checklists_update_own_operations_manager" ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete_own_operations_manager" ON public.checklists;
DROP POLICY IF EXISTS "responses_select_operations_manager" ON public.checklist_responses;
DROP POLICY IF EXISTS "responses_insert_operations_manager" ON public.checklist_responses;
DROP POLICY IF EXISTS "responses_update_operations_manager" ON public.checklist_responses;

DROP FUNCTION IF EXISTS public.checklist_template_context(UUID);

NOTIFY pgrst, 'reload schema';
