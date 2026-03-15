-- Fix: Allow Driver and Yard Auditor to delete their own in-progress checklists
-- (needed for the "Cancelar checklist" button in the driver view)
DROP POLICY IF EXISTS "checklists_delete_own_driver" ON public.checklists;

CREATE POLICY "checklists_delete_own_driver" ON public.checklists
  FOR DELETE USING (
    filled_by = auth.uid()
    AND status = 'in_progress'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Driver', 'Yard Auditor')
  );
