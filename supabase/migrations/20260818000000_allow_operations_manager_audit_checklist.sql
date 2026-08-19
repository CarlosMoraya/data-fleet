-- Permite que o Gestor de Operações execute e consulte checklists de Auditoria
-- somente nos veículos pertencentes ao escopo atribuído ao perfil.

CREATE OR REPLACE FUNCTION public.checklist_template_context(p_template_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT context FROM public.checklist_templates WHERE id = p_template_id;
$$;

GRANT EXECUTE ON FUNCTION public.checklist_template_context(UUID) TO authenticated;

DROP POLICY IF EXISTS "templates_select_operations_manager" ON public.checklist_templates;
CREATE POLICY "templates_select_operations_manager" ON public.checklist_templates
  FOR SELECT USING (
    status = 'published'
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND context = 'Auditoria'
  );

DROP POLICY IF EXISTS "checklist_items_select_operations_manager" ON public.checklist_items;
CREATE POLICY "checklist_items_select_operations_manager" ON public.checklist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.checklist_templates t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = checklist_items.template_id
        AND t.client_id = p.client_id
        AND p.role = 'Operations Manager'
        AND t.context = 'Auditoria'
    )
  );

DROP POLICY IF EXISTS "checklists_select_operations_manager" ON public.checklists;
CREATE POLICY "checklists_select_operations_manager" ON public.checklists
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND public.checklist_template_context(template_id) = 'Auditoria'
    AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
  );

DROP POLICY IF EXISTS "checklists_insert_operations_manager" ON public.checklists;
CREATE POLICY "checklists_insert_operations_manager" ON public.checklists
  FOR INSERT WITH CHECK (
    filled_by = auth.uid()
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND public.checklist_template_context(template_id) = 'Auditoria'
    AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
  );

DROP POLICY IF EXISTS "checklists_update_own_operations_manager" ON public.checklists;
CREATE POLICY "checklists_update_own_operations_manager" ON public.checklists
  FOR UPDATE USING (
    filled_by = auth.uid()
    AND status = 'in_progress'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
  ) WITH CHECK (
    filled_by = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
  );

DROP POLICY IF EXISTS "checklists_delete_own_operations_manager" ON public.checklists;
CREATE POLICY "checklists_delete_own_operations_manager" ON public.checklists
  FOR DELETE USING (
    filled_by = auth.uid()
    AND status = 'in_progress'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
  );

DROP POLICY IF EXISTS "responses_select_operations_manager" ON public.checklist_responses;
CREATE POLICY "responses_select_operations_manager" ON public.checklist_responses
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_responses.checklist_id
        AND public.checklist_template_context(c.template_id) = 'Auditoria'
        AND public.operations_manager_can_access_vehicle_id(auth.uid(), c.vehicle_id)
    )
  );

DROP POLICY IF EXISTS "responses_insert_operations_manager" ON public.checklist_responses;
CREATE POLICY "responses_insert_operations_manager" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_responses.checklist_id
        AND c.filled_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "responses_update_operations_manager" ON public.checklist_responses;
CREATE POLICY "responses_update_operations_manager" ON public.checklist_responses
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_responses.checklist_id
        AND c.filled_by = auth.uid()
        AND c.status = 'in_progress'
    )
  ) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
    AND EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_responses.checklist_id
        AND c.filled_by = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
