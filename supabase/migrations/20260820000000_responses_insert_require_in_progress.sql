-- Impede a inserção de novas respostas em checklists já concluídos.
-- Aplicar em DEV antes de PROD e somente após o bloqueio da finalização
-- enquanto houver respostas pendentes na fila offline.

DROP POLICY IF EXISTS "responses_insert" ON public.checklist_responses;

CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE c.status = 'in_progress'
        AND (
          (p.client_id = c.client_id AND p.role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
          OR p.role = 'Admin Master'
        )
    )
  );

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- DROP POLICY IF EXISTS "responses_insert" ON public.checklist_responses;
--
-- CREATE POLICY "responses_insert" ON public.checklist_responses
--   FOR INSERT WITH CHECK (
--     auth.uid() IN (
--       SELECT p.id FROM public.profiles p
--       JOIN public.checklists c ON c.id = checklist_responses.checklist_id
--       WHERE (
--         (p.client_id = c.client_id AND p.role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
--         OR p.role = 'Admin Master'
--       )
--     )
--   );
--
-- NOTIFY pgrst, 'reload schema';
