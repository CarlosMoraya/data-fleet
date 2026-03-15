-- Permite que Yard Auditors vejam todos os veículos do seu próprio tenant
-- (necessário para o dropdown de seleção de veículo no fluxo de Auditoria)
DROP POLICY IF EXISTS "vehicles_select_auditor" ON public.vehicles;
CREATE POLICY "vehicles_select_auditor"
  ON public.vehicles
  FOR SELECT
  USING (
    client_id = public.get_my_client_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Yard Auditor'
  );
