-- Fix: Allow Driver and Yard Auditor to read workshops in their own tenant
-- Needed for Entrada/Saída de Oficina checklist context workshop selection
DROP POLICY IF EXISTS "workshops_select" ON public.workshops;

CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id
          AND role IN ('Driver', 'Yard Auditor', 'Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director'))
        OR role = 'Admin Master'
      )
    )
  );
