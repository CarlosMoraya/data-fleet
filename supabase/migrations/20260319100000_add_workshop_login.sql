-- ============================================================
-- MIGRATION: add_workshop_login
-- Descrição: Permite que oficinas parceiras tenham acesso ao
--            sistema com login próprio. A oficina vê apenas
--            a tela de Manutenção, filtrada para suas OS.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- ─── 1. Atualizar CHECK constraint em profiles.role ────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'Driver', 'Yard Auditor', 'Workshop', 'Fleet Assistant',
    'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'
  ));

-- ─── 2. Atualizar função role_rank() para incluir 'Workshop' ─

CREATE OR REPLACE FUNCTION public.role_rank(role_name TEXT) RETURNS INT AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'Driver'          THEN 1
    WHEN 'Workshop'        THEN 1
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

-- ─── 3. Adicionar profile_id na tabela workshops ────────────

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workshops_profile_id ON public.workshops(profile_id);

-- ─── 4. RLS em maintenance_orders — adicionar acesso Workshop ─

-- Dropar e recriar SELECT e UPDATE para incluir Workshop

DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_orders;
DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_orders;

-- SELECT: Fleet Assistant+ (próprio tenant) OU Admin Master OU Workshop (apenas sua workshop)
CREATE POLICY "maintenance_select" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND workshop_id IN (
        SELECT id FROM public.workshops WHERE profile_id = auth.uid()
      )
    )
  );

-- UPDATE: Fleet Assistant+ (próprio tenant) OU Admin Master OU Workshop (apenas sua workshop)
CREATE POLICY "maintenance_update" ON public.maintenance_orders
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND workshop_id IN (
        SELECT id FROM public.workshops WHERE profile_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
  );

-- ─── 5. RLS em maintenance_budget_items — adicionar acesso Workshop ─

DROP POLICY IF EXISTS "budget_items_select" ON public.maintenance_budget_items;
DROP POLICY IF EXISTS "budget_items_insert" ON public.maintenance_budget_items;
DROP POLICY IF EXISTS "budget_items_update" ON public.maintenance_budget_items;
DROP POLICY IF EXISTS "budget_items_delete" ON public.maintenance_budget_items;

-- Helper subquery reutilizado: IDs de OS pertencentes à workshop do usuário
-- (usamos inline em cada policy para compatibilidade com Supabase RLS)

CREATE POLICY "budget_items_select" ON public.maintenance_budget_items FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        JOIN public.workshops w ON w.id = mo.workshop_id
        WHERE w.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "budget_items_insert" ON public.maintenance_budget_items FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        JOIN public.workshops w ON w.id = mo.workshop_id
        WHERE w.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "budget_items_update" ON public.maintenance_budget_items FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        JOIN public.workshops w ON w.id = mo.workshop_id
        WHERE w.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "budget_items_delete" ON public.maintenance_budget_items FOR DELETE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        JOIN public.workshops w ON w.id = mo.workshop_id
        WHERE w.profile_id = auth.uid()
      )
    )
  );

-- ─── 6. RLS em workshops — Workshop pode ler seu próprio registro ─

-- Adicionar policy SELECT para Workshop (ver dados da própria oficina)
-- As policies existentes já cobrem Fleet Assistant+; adicionamos caso especial

DROP POLICY IF EXISTS "workshop_self_select" ON public.workshops;

CREATE POLICY "workshop_self_select" ON public.workshops
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
  );
