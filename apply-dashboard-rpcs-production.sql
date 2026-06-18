-- Aplicar no SQL Editor do Supabase (projeto oajfjdadcicgoxrfrnny). Idempotente (CREATE OR REPLACE).
-- Cria as 4 RPCs de agregação consumidas pelo Dashboard. Corrige os 404 em rpc/dashboard_*.
-- Conteúdo idêntico às migrações 20260617000000_create_dashboard_cost_rpcs.sql
-- e 20260617000100_create_dashboard_checklist_rpcs.sql.

-- ============================================================================
-- Dashboard cost aggregation RPCs (SECURITY INVOKER → herda RLS de maintenance_orders).
-- p_client_id NULL = caso Admin Master: não filtra por tenant, RLS governa.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_previous_period_cost(
  p_client_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(mo.approved_cost), 0)::NUMERIC
  FROM public.maintenance_orders mo
  WHERE mo.entry_date >= p_from
    AND mo.entry_date <= p_to
    AND mo.status <> 'Cancelado'
    AND mo.approved_cost IS NOT NULL
    AND mo.approved_cost > 0
    AND (p_client_id IS NULL OR mo.client_id = p_client_id);
$$;

CREATE OR REPLACE FUNCTION public.dashboard_cost_projection_monthly(
  p_client_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (month_key TEXT, total NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT to_char(mo.entry_date, 'YYYY-MM') AS month_key,
         COALESCE(SUM(mo.approved_cost), 0)::NUMERIC AS total
  FROM public.maintenance_orders mo
  WHERE mo.entry_date >= p_from
    AND mo.entry_date < p_to
    AND mo.status <> 'Cancelado'
    AND mo.approved_cost IS NOT NULL
    AND mo.approved_cost > 0
    AND (p_client_id IS NULL OR mo.client_id = p_client_id)
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_previous_period_cost(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_cost_projection_monthly(UUID, DATE, DATE) TO authenticated;

-- ============================================================================
-- Dashboard checklist aggregation RPCs (SECURITY INVOKER → herda RLS de checklists).
-- p_client_id NULL = caso Admin Master: não filtra por tenant, RLS governa.
-- ============================================================================

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
