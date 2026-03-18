-- ============================================================
-- Adiciona novos roles: Supervisor (rank 4) e Coordinator (rank 5)
-- Supervisor espelha todas as permissões de Fleet Analyst
-- Coordinator espelha todas as permissões de Manager
-- ============================================================

-- ─── 0. Atualizar CHECK constraint em profiles.role ────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'Driver', 'Yard Auditor', 'Fleet Assistant',
    'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'
  ));

-- ─── 1. Atualizar a função role_rank() ─────────────────────

CREATE OR REPLACE FUNCTION public.role_rank(role_name TEXT) RETURNS INT AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'Driver'          THEN 1
    WHEN 'Yard Auditor'    THEN 2
    WHEN 'Fleet Assistant' THEN 3
    WHEN 'Fleet Analyst'   THEN 4
    WHEN 'Supervisor'      THEN 4
    WHEN 'Manager'         THEN 5
    WHEN 'Coordinator'     THEN 5
    WHEN 'Director'        THEN 6
    WHEN 'Admin Master'    THEN 7
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- ─── 2. Atualizar RLS policies em workshops ───────────────

-- DROP existing policies
DROP POLICY IF EXISTS "workshops_select" ON public.workshops;
DROP POLICY IF EXISTS "workshops_insert" ON public.workshops;
DROP POLICY IF EXISTS "workshops_update" ON public.workshops;
DROP POLICY IF EXISTS "workshops_delete" ON public.workshops;

-- SELECT: Fleet Assistant (rank 3)+ do mesmo tenant, ou Admin Master (rank 7)
CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Fleet Assistant (rank 3)+ do mesmo tenant, ou Admin Master
CREATE POLICY "workshops_insert" ON public.workshops
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Fleet Analyst (rank 4)+ do mesmo tenant, ou Admin Master
CREATE POLICY "workshops_update" ON public.workshops
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- DELETE: Manager (rank 5)+ OU Fleet Analyst com can_delete_workshops = true
CREATE POLICY "workshops_delete" ON public.workshops
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Manager','Coordinator','Director'))
        OR role = 'Admin Master'
        OR (client_id = workshops.client_id AND role IN ('Fleet Analyst','Supervisor') AND can_delete_workshops = true)
      )
    )
  );

-- ─── 3. Atualizar RLS policies em checklist_templates ─────

DROP POLICY IF EXISTS "checklist_templates_select" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_delete" ON public.checklist_templates;

-- SELECT: Fleet Assistant (rank 3)+
CREATE POLICY "checklist_templates_select" ON public.checklist_templates
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Fleet Assistant (rank 3)+
CREATE POLICY "checklist_templates_insert" ON public.checklist_templates
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Fleet Analyst (rank 4)+
CREATE POLICY "checklist_templates_update" ON public.checklist_templates
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- DELETE: Admin Master only
CREATE POLICY "checklist_templates_delete" ON public.checklist_templates
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role = 'Admin Master'
    )
  );

-- ─── 4. Atualizar RLS policies em checklist_items ────────

DROP POLICY IF EXISTS "checklist_items_select" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_update" ON public.checklist_items;

-- SELECT
CREATE POLICY "checklist_items_select" ON public.checklist_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- INSERT
CREATE POLICY "checklist_items_insert" ON public.checklist_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- UPDATE
CREATE POLICY "checklist_items_update" ON public.checklist_items
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- ─── 5. Atualizar RLS policies em checklists ──────────────

DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
DROP POLICY IF EXISTS "checklists_update" ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete" ON public.checklists;

-- SELECT: Driver/Auditor vê os próprios; Fleet Assistant+ vê todos do tenant
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (id = checklists.filled_by AND role IN ('Driver','Yard Auditor'))
        OR (client_id = checklists.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Qualquer usuário autenticado do tenant
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklists.client_id AND role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Apenas quem criou, enquanto in_progress
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    auth.uid() = checklists.filled_by
    AND checklists.status = 'in_progress'
  );

-- DELETE: APENAS Admin Master
CREATE POLICY "checklists_delete" ON public.checklists
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'Admin Master'
    )
  );

-- ─── 6. Atualizar RLS policies em checklist_responses ────

DROP POLICY IF EXISTS "responses_select" ON public.checklist_responses;
DROP POLICY IF EXISTS "responses_insert" ON public.checklist_responses;
DROP POLICY IF EXISTS "responses_update" ON public.checklist_responses;

-- SELECT
CREATE POLICY "responses_select" ON public.checklist_responses
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE (
        (p.id = c.filled_by AND p.role IN ('Driver','Yard Auditor'))
        OR (p.client_id = c.client_id AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- INSERT
CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE (
        (p.client_id = c.client_id AND p.role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- UPDATE
CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE p.id = c.filled_by AND c.status = 'in_progress'
    )
  );

-- ─── 7. Atualizar RLS policies em action_plans ─────────────

DROP POLICY IF EXISTS "action_plans_select" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans_insert" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans_update" ON public.action_plans;

-- SELECT
CREATE POLICY "action_plans_select" ON public.action_plans
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM public.profiles
      WHERE (
        id = auth.uid() AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
      )
      OR id = auth.uid() AND role = 'Admin Master'
    )
  );

-- INSERT
CREATE POLICY "action_plans_insert" ON public.action_plans
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT client_id FROM public.profiles
      WHERE (
        id = auth.uid() AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
      )
      OR id = auth.uid() AND role = 'Admin Master'
    )
  );

-- UPDATE
CREATE POLICY "action_plans_update" ON public.action_plans
  FOR UPDATE USING (
    client_id IN (
      SELECT client_id FROM public.profiles
      WHERE (
        id = auth.uid() AND role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
      )
      OR id = auth.uid() AND role = 'Admin Master'
    )
  );
