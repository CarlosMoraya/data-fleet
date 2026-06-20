-- Dashboard checklist aggregation RPCs (SECURITY INVOKER → herda RLS de checklists).
-- p_client_id NULL = caso Admin Master: não filtra por tenant, RLS governa.

CREATE OR REPLACE FUNCTION public.dashboard_last_checklist_per_vehicle(
  p_client_id UUID
)
RETURNS TABLE (vehicle_id UUID, context TEXT, completed_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (c.vehicle_id, ct.context)
         c.vehicle_id,
         ct.context,
         c.completed_at
  FROM public.checklists c
  JOIN public.checklist_templates ct ON ct.id = c.template_id
  WHERE c.status = 'completed'
    AND c.vehicle_id IS NOT NULL
    AND c.completed_at IS NOT NULL
    AND ct.context IN ('Rotina', 'Segurança')
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  ORDER BY c.vehicle_id, ct.context, c.completed_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_vehicle_km_in_period(
  p_client_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (vehicle_id UUID, km_driven NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- MAX−MIN é a regra aprovada de KM rodado no período (2026-06-20): idêntico ao "último−primeiro" quando o odômetro é monotônico e mais robusto contra leituras fora de ordem. Não trocar pela versão literal por data.
  SELECT c.vehicle_id,
         (MAX(c.odometer_km) - MIN(c.odometer_km))::NUMERIC AS km_driven
  FROM public.checklists c
  WHERE c.status = 'completed'
    AND c.vehicle_id IS NOT NULL
    AND c.odometer_km IS NOT NULL
    AND c.completed_at::date >= p_from
    AND c.completed_at::date <= p_to
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.vehicle_id
  HAVING COUNT(c.odometer_km) >= 2
     AND (MAX(c.odometer_km) - MIN(c.odometer_km)) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_last_checklist_per_vehicle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_vehicle_km_in_period(UUID, DATE, DATE) TO authenticated;
