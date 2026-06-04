DROP POLICY IF EXISTS "vfs_insert" ON public.vehicle_field_settings;
DROP POLICY IF EXISTS "vfs_update" ON public.vehicle_field_settings;

CREATE POLICY "vfs_insert" ON public.vehicle_field_settings
  FOR INSERT WITH CHECK (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  );

CREATE POLICY "vfs_update" ON public.vehicle_field_settings
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
