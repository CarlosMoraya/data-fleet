-- ============================================================
-- MIGRATION: fix_action_plans_admin_master_rls
-- Data: 2026-03-18
-- Problema: O Admin Master tem client_id = NULL no profile.
--   A política anterior usava:
--     client_id IN (SELECT client_id FROM profiles WHERE ... OR role = 'Admin Master')
--   Como NULL IN (NULL) é UNKNOWN em SQL (nunca TRUE), o Admin Master
--   ficava bloqueado de INSERT/SELECT/UPDATE em action_plans.
-- Solução: Usar EXISTS com verificação direta de role = 'Admin Master'.
-- ============================================================

DROP POLICY IF EXISTS "action_plans_select" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans_insert" ON public.action_plans;
DROP POLICY IF EXISTS "action_plans_update" ON public.action_plans;

-- SELECT: Fleet Assistant+ do tenant OU Admin Master
CREATE POLICY "action_plans_select" ON public.action_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- INSERT: Fleet Analyst+ do tenant OU Admin Master
CREATE POLICY "action_plans_insert" ON public.action_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- UPDATE: Fleet Assistant+ do tenant OU Admin Master
CREATE POLICY "action_plans_update" ON public.action_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = action_plans.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );
