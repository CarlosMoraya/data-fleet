-- Dashboard cost aggregation RPCs (SECURITY INVOKER → herda RLS de maintenance_orders).
-- p_client_id NULL = caso Admin Master: não filtra por tenant, RLS governa.

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
