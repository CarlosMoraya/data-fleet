-- ============================================================
-- Correção de RLS: Settings (vehicle_field_settings e driver_field_settings)
-- ============================================================
-- Instrução: Execute este script no SQL Editor do Supabase Dashboard.
-- Ele recria as políticas de leitura e gravação usando funções 
-- seguras e sem recursão (evitando erros 409 e 403 no Admin Master).

-- ==========================================
-- 1. Tabela: vehicle_field_settings
-- ==========================================
ALTER TABLE public.vehicle_field_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vfs_select" ON public.vehicle_field_settings;
DROP POLICY IF EXISTS "vfs_insert" ON public.vehicle_field_settings;
DROP POLICY IF EXISTS "vfs_update" ON public.vehicle_field_settings;

-- SELECT: Leitura para Fleet Assistant+ do próprio tenant, e leitura total para Admin Master.
CREATE POLICY "vfs_select" ON public.vehicle_field_settings
  FOR SELECT USING (
    (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
    OR public.is_admin_master()
  );

-- INSERT: Limite para Manager+ no seu tenant, e total para Admin Master.
CREATE POLICY "vfs_insert" ON public.vehicle_field_settings
  FOR INSERT WITH CHECK (
    (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Manager')
    )
    OR public.is_admin_master()
  );

-- UPDATE: Limite para Manager+ no seu tenant, e total para Admin Master.
CREATE POLICY "vfs_update" ON public.vehicle_field_settings
  FOR UPDATE USING (
    (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Manager')
    )
    OR public.is_admin_master()
  );


-- ==========================================
-- 2. Tabela: driver_field_settings
-- ==========================================
ALTER TABLE public.driver_field_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dfs_select" ON public.driver_field_settings;
DROP POLICY IF EXISTS "dfs_insert" ON public.driver_field_settings;
DROP POLICY IF EXISTS "dfs_update" ON public.driver_field_settings;

-- SELECT: Leitura para Fleet Assistant+ do próprio tenant, e leitura total para Admin Master.
CREATE POLICY "dfs_select" ON public.driver_field_settings
  FOR SELECT USING (
    (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
    OR public.is_admin_master()
  );

-- INSERT: Limite para Manager+ no seu tenant, e total para Admin Master.
CREATE POLICY "dfs_insert" ON public.driver_field_settings
  FOR INSERT WITH CHECK (
    (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Manager')
    )
    OR public.is_admin_master()
  );

-- UPDATE: Limite para Manager+ no seu tenant, e total para Admin Master.
CREATE POLICY "dfs_update" ON public.driver_field_settings
  FOR UPDATE USING (
    (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Manager')
    )
    OR public.is_admin_master()
  );
