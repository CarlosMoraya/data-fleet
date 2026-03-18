-- ============================================================
-- FIX: RLS checklists_update sem WITH CHECK
-- Problema: Policy sem WITH CHECK usa USING como pós-verificação,
-- rejeitando silenciosamente o update in_progress → completed.
-- Solução: adicionar WITH CHECK que verifica apenas filled_by.
-- ============================================================

DROP POLICY IF EXISTS "checklists_update" ON public.checklists;

CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    auth.uid() = checklists.filled_by
    AND checklists.status = 'in_progress'
  ) WITH CHECK (
    auth.uid() = checklists.filled_by
  );
