-- Fix: as políticas RLS de tire_inspections e tire_inspection_responses liam o
-- cargo via (auth.jwt() ->> 'role'), mas neste projeto o cargo é armazenado em
-- public.profiles (não há claim de role no JWT nem hook). Resultado: o cargo resolvia
-- para NULL e qualquer INSERT/UPDATE/SELECT por Driver/Manager/etc. era negado
-- ("new row violates row-level security policy for table tire_inspections").
-- Correção: usar (SELECT role FROM public.profiles WHERE id = auth.uid()),
-- padrão do restante do schema (ver tires). Corrige também 'Auditor' -> 'Yard Auditor'.

-- ── tire_inspections ──────────────────────────────────────────
DROP POLICY IF EXISTS "tire_inspections_select" ON public.tire_inspections;
DROP POLICY IF EXISTS "tire_inspections_insert" ON public.tire_inspections;
DROP POLICY IF EXISTS "tire_inspections_update" ON public.tire_inspections;
DROP POLICY IF EXISTS "tire_inspections_delete" ON public.tire_inspections;

CREATE POLICY "tire_inspections_select" ON public.tire_inspections
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
          IN ('Manager','Fleet Assistant','Fleet Analyst','Supervisor')
        OR filled_by = auth.uid()
      )
    )
  );

CREATE POLICY "tire_inspections_insert" ON public.tire_inspections
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('Driver','Yard Auditor','Fleet Assistant','Manager','Supervisor')
    )
  );

CREATE POLICY "tire_inspections_update" ON public.tire_inspections
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (
        filled_by = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager','Fleet Assistant')
      )
    )
  );

CREATE POLICY "tire_inspections_delete" ON public.tire_inspections
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- ── tire_inspection_responses ─────────────────────────────────
DROP POLICY IF EXISTS "tire_inspection_responses_select" ON public.tire_inspection_responses;
DROP POLICY IF EXISTS "tire_inspection_responses_insert" ON public.tire_inspection_responses;
DROP POLICY IF EXISTS "tire_inspection_responses_update" ON public.tire_inspection_responses;
DROP POLICY IF EXISTS "tire_inspection_responses_delete" ON public.tire_inspection_responses;

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
                IN ('Manager','Fleet Assistant','Fleet Analyst','Supervisor')
              OR ti.filled_by = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "tire_inspection_responses_insert" ON public.tire_inspection_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tire_inspections ti
      WHERE ti.id = inspection_id
        AND (
          (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
          OR (
            ti.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (
              ti.filled_by = auth.uid()
              OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager','Fleet Assistant')
            )
          )
        )
    )
  );

CREATE POLICY "tire_inspection_responses_update" ON public.tire_inspection_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tire_inspections ti
      WHERE ti.id = inspection_id
        AND (
          (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
          OR (
            ti.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
            AND (
              ti.filled_by = auth.uid()
              OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager','Fleet Assistant')
            )
          )
        )
    )
  );

CREATE POLICY "tire_inspection_responses_delete" ON public.tire_inspection_responses
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );