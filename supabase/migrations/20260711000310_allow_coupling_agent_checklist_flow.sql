-- Permite que o Coupling Agent execute o fluxo isolado de Engate/Desengate
-- sem ganhar acesso à frota fora do próprio checklist.

DROP POLICY IF EXISTS "templates_select_coupling_agent" ON public.checklist_templates;
CREATE POLICY "templates_select_coupling_agent" ON public.checklist_templates
  FOR SELECT USING (
    status = 'published'
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

DROP POLICY IF EXISTS "checklist_items_select_coupling_agent" ON public.checklist_items;
CREATE POLICY "checklist_items_select_coupling_agent" ON public.checklist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.checklist_templates t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = checklist_items.template_id
        AND t.client_id = p.client_id
        AND p.role = 'Coupling Agent'
    )
  );

DROP POLICY IF EXISTS "checklists_select_own_coupling_agent" ON public.checklists;
CREATE POLICY "checklists_select_own_coupling_agent" ON public.checklists
  FOR SELECT USING (
    filled_by = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

DROP POLICY IF EXISTS "checklists_insert_coupling_agent" ON public.checklists;
CREATE POLICY "checklists_insert_coupling_agent" ON public.checklists
  FOR INSERT WITH CHECK (
    filled_by = auth.uid()
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

DROP POLICY IF EXISTS "checklists_update_own_coupling_agent" ON public.checklists;
CREATE POLICY "checklists_update_own_coupling_agent" ON public.checklists
  FOR UPDATE USING (
    filled_by = auth.uid()
    AND status = 'in_progress'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  ) WITH CHECK (
    filled_by = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

DROP POLICY IF EXISTS "responses_select_own_coupling_agent" ON public.checklist_responses;
CREATE POLICY "responses_select_own_coupling_agent" ON public.checklist_responses
  FOR SELECT USING (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE c.filled_by = auth.uid()
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

DROP POLICY IF EXISTS "responses_insert_own_coupling_agent" ON public.checklist_responses;
CREATE POLICY "responses_insert_own_coupling_agent" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE c.filled_by = auth.uid()
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

DROP POLICY IF EXISTS "responses_update_own_coupling_agent" ON public.checklist_responses;
CREATE POLICY "responses_update_own_coupling_agent" ON public.checklist_responses
  FOR UPDATE USING (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE c.filled_by = auth.uid()
        AND c.status = 'in_progress'
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  ) WITH CHECK (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE c.filled_by = auth.uid()
    )
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Coupling Agent'
  );

NOTIFY pgrst, 'reload schema';
