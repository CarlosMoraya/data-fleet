DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
        ('Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Coordinator', 'Manager', 'Director', 'Yard Auditor', 'Admin Master')
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );
