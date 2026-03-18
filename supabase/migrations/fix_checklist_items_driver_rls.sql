-- ============================================================
-- Corrige RLS policy de SELECT em checklist_items para
-- incluir Driver e Yard Auditor (removidos por engano em
-- add_supervisor_coordinator_roles.sql).
-- Executar no Supabase Dashboard → SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "checklist_items_select" ON public.checklist_items;

CREATE POLICY "checklist_items_select" ON public.checklist_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN (
          'Driver','Yard Auditor',
          'Fleet Assistant','Fleet Analyst','Supervisor',
          'Manager','Coordinator','Director'
        ))
        OR p.role = 'Admin Master'
      )
    )
  );
