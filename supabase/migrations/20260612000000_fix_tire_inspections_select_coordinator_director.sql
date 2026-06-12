-- Fix: a aba "Inspeções de Pneus" (Checklists) é exibida para Coordinator e Director
-- (src/pages/Checklists.tsx > isAssistantPlus), mas as políticas RLS de SELECT de
-- tire_inspections e tire_inspection_responses só liberam a visão do tenant para
-- ('Manager','Fleet Assistant','Fleet Analyst','Supervisor'). Resultado: Coordinator
-- e Director recebem 0 linhas (RLS filtra sem erro) e a aba mostra "Nenhuma inspeção
-- de pneus registrada neste tenant", mesmo havendo inspeções concluídas.
-- Correção estritamente aditiva: acrescenta 'Coordinator' e 'Director' à lista de
-- SELECT. Nenhuma outra política (INSERT/UPDATE/DELETE) é alterada.

-- ── tire_inspections (SELECT) ─────────────────────────────────
DROP POLICY IF EXISTS "tire_inspections_select" ON public.tire_inspections;

CREATE POLICY "tire_inspections_select" ON public.tire_inspections
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('Manager','Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Director')
        OR filled_by = auth.uid()
      )
    )
  );

-- ── tire_inspection_responses (SELECT) ────────────────────────
DROP POLICY IF EXISTS "tire_inspection_responses_select" ON public.tire_inspection_responses;

CREATE POLICY "tire_inspection_responses_select" ON public.tire_inspection_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tire_inspections ti
      WHERE ti.id = inspection_id
        AND (
          (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
          OR (
            ti.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (
              (SELECT role FROM public.profiles WHERE id = auth.uid())
                IN ('Manager','Fleet Assistant','Fleet Analyst','Supervisor','Coordinator','Director')
              OR ti.filled_by = auth.uid()
            )
          )
        )
    )
  );