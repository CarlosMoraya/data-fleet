-- ============================================================
-- MIGRATION: fix_admin_master_drivers_permissions
-- Data: 2026-03-14
-- Descrição: Ajusta as políticas de RLS para garantir que o Admin Master 
--            possa realizar operações de CRUD em todos os tenants.
-- ============================================================

-- 1. Tabela public.drivers
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;

-- INSERT: Fleet Assistant+ do próprio tenant OU Admin Master
CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT WITH CHECK (
    (client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
     AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
       ('Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- UPDATE: Fleet Analyst+ do próprio tenant OU Admin Master
CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE USING (
    (client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
     AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
       ('Fleet Analyst', 'Manager', 'Director', 'Admin Master'))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- DELETE: Manager+ OU Fleet Analyst com flag can_delete_drivers OU Admin Master
CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE USING (
    (client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
     AND (
       (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager', 'Director', 'Admin Master')
       OR (
         (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Fleet Analyst'
         AND (SELECT can_delete_drivers FROM public.profiles WHERE id = auth.uid()) = true
       )
     ))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );


-- 2. Tabela public.driver_field_settings
DROP POLICY IF EXISTS "dfs_insert" ON public.driver_field_settings;
DROP POLICY IF EXISTS "dfs_update" ON public.driver_field_settings;

-- INSERT: Manager+ do próprio tenant OU Admin Master
CREATE POLICY "dfs_insert" ON public.driver_field_settings
  FOR INSERT WITH CHECK (
    (client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
     AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
       ('Manager', 'Director', 'Admin Master'))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- UPDATE: Manager+ do próprio tenant OU Admin Master
CREATE POLICY "dfs_update" ON public.driver_field_settings
  FOR UPDATE USING (
    (client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
     AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
       ('Manager', 'Director', 'Admin Master'))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );


-- 3. Políticas de Storage (bucket: driver-documents)
DROP POLICY IF EXISTS "Driver Documents Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Driver Documents Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Driver Documents Authenticated Delete" ON storage.objects;

-- Função auxiliar para validar acesso ao diretório do tenant ou Admin Master
CREATE OR REPLACE FUNCTION public.can_access_driver_path(object_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (storage.foldername(object_name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Driver Documents Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND public.can_access_driver_path(name)
  );

CREATE POLICY "Driver Documents Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND public.can_access_driver_path(name)
  );

CREATE POLICY "Driver Documents Authenticated Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND public.can_access_driver_path(name)
  );
