-- Align checklist template draft deletion with the UI permissions.
-- Coordinator/Manager/Director can manage draft templates for their tenant;
-- Admin Master remains cross-tenant.

DROP POLICY IF EXISTS "checklist_templates_delete" ON public.checklist_templates;

CREATE POLICY "checklist_templates_delete" ON public.checklist_templates
  FOR DELETE USING (
    auth.uid() IN (
      SELECT p.id
      FROM public.profiles p
      WHERE (
        (p.client_id = checklist_templates.client_id AND p.role IN ('Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

DROP POLICY IF EXISTS "checklist_items_delete" ON public.checklist_items;

CREATE POLICY "checklist_items_delete" ON public.checklist_items
  FOR DELETE USING (
    auth.uid() IN (
      SELECT p.id
      FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );
