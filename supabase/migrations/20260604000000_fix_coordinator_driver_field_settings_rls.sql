-- ============================================================
-- Fix: Coordinator deve conseguir salvar driver_field_settings
-- Espelha a correção aplicada em vehicle_field_settings em 2026-06-03.
-- Causa raiz: dfs_insert/dfs_update exigiam role_rank >= Manager,
-- bloqueando Coordinator que é habilitado pela UI (Settings.tsx).
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD (SQL Editor)
-- ============================================================

DROP POLICY IF EXISTS "dfs_insert" ON public.driver_field_settings;
DROP POLICY IF EXISTS "dfs_update" ON public.driver_field_settings;

CREATE POLICY "dfs_insert" ON public.driver_field_settings
  FOR INSERT WITH CHECK (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  );

CREATE POLICY "dfs_update" ON public.driver_field_settings
  FOR UPDATE USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  )
  WITH CHECK (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  );