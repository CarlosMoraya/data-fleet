-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (dev primeiro)
-- Defensivo: dev/prod têm nomes de policy divergentes.
-- Removemos todos os nomes conhecidos e recriamos um único DELETE por tabela.

-- vehicles
DROP POLICY IF EXISTS "vehicles_delete_tenant" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete_admin"  ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete"        ON public.vehicles;
CREATE POLICY "vehicles_delete_admin_only" ON public.vehicles
  FOR DELETE USING (public.is_admin_master());

-- drivers
DROP POLICY IF EXISTS "drivers_delete"        ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete_tenant" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete_admin"  ON public.drivers;
CREATE POLICY "drivers_delete_admin_only" ON public.drivers
  FOR DELETE USING (public.is_admin_master());

-- workshops
DROP POLICY IF EXISTS "workshops_delete"        ON public.workshops;
DROP POLICY IF EXISTS "workshops_delete_tenant" ON public.workshops;
DROP POLICY IF EXISTS "workshops_delete_admin"  ON public.workshops;
CREATE POLICY "workshops_delete_admin_only" ON public.workshops
  FOR DELETE USING (public.is_admin_master());

-- shippers
DROP POLICY IF EXISTS "shippers_delete"        ON public.shippers;
DROP POLICY IF EXISTS "shippers_delete_tenant" ON public.shippers;
DROP POLICY IF EXISTS "shippers_delete_admin"  ON public.shippers;
CREATE POLICY "shippers_delete_admin_only" ON public.shippers
  FOR DELETE USING (public.is_admin_master());

-- operational_units
DROP POLICY IF EXISTS "operational_units_delete"        ON public.operational_units;
DROP POLICY IF EXISTS "operational_units_delete_tenant" ON public.operational_units;
DROP POLICY IF EXISTS "operational_units_delete_admin"  ON public.operational_units;
CREATE POLICY "operational_units_delete_admin_only" ON public.operational_units
  FOR DELETE USING (public.is_admin_master());
