-- Recria dashboard_last_checklist_per_vehicle (removida em 20260619000003).
-- O frontend (Dashboard e Veículos) depende desta RPC para o filtro/KPI de checklist vencido.
-- SECURITY INVOKER -> herda RLS de checklists. p_client_id NULL = Admin Master (RLS governa).
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

GRANT EXECUTE ON FUNCTION public.dashboard_last_checklist_per_vehicle(UUID) TO authenticated;
