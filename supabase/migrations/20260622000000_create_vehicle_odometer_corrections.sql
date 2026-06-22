-- ============================================================
-- MIGRATION: create_vehicle_odometer_corrections
-- Correção auditável mínima de KM/hodômetro.
-- O KM original em checklists.odometer_km NUNCA é sobrescrito.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV primeiro)
-- ============================================================

-- 1) Tabela de auditoria (append-only)
CREATE TABLE IF NOT EXISTS public.vehicle_odometer_corrections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.clients(id),
  vehicle_id   uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  original_km  numeric NOT NULL,
  corrected_km numeric NOT NULL CHECK (corrected_km >= 0),
  reason       text NOT NULL CHECK (length(btrim(reason)) > 0),
  corrected_by uuid NOT NULL REFERENCES public.profiles(id),
  corrected_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_corrections_vehicle
  ON public.vehicle_odometer_corrections (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_corrections_checklist
  ON public.vehicle_odometer_corrections (checklist_id);

ALTER TABLE public.vehicle_odometer_corrections ENABLE ROW LEVEL SECURITY;

-- 2) RLS
-- SELECT: qualquer usuário com acesso a veículos do tenant (rank >= 3) OU Admin Master.
DROP POLICY IF EXISTS "odometer_corrections_select" ON public.vehicle_odometer_corrections;
CREATE POLICY "odometer_corrections_select" ON public.vehicle_odometer_corrections
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- INSERT: apenas Manager+ (role_rank >= 6 = Coordinator/Manager/Director) do tenant
--         OU Admin Master (cross-tenant). corrected_by deve ser o próprio usuário.
DROP POLICY IF EXISTS "odometer_corrections_insert" ON public.vehicle_odometer_corrections;
CREATE POLICY "odometer_corrections_insert" ON public.vehicle_odometer_corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    corrected_by = auth.uid()
    AND (
      (
        (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 6
        AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

-- Sem policies de UPDATE/DELETE: tabela é imutável (auditável).

-- 3) View de KM efetivo (única fonte de verdade).
--    effective_km = correção mais recente do checklist, senão o KM original do checklist.
--    security_invoker = true → herda RLS de checklists e de vehicle_odometer_corrections.
CREATE OR REPLACE VIEW public.vehicle_odometer_effective_readings
WITH (security_invoker = true) AS
  SELECT
    c.id                                       AS checklist_id,
    c.vehicle_id                               AS vehicle_id,
    c.client_id                                AS client_id,
    c.completed_at                             AS reading_at,
    c.odometer_km                              AS original_km,
    COALESCE(corr.corrected_km, c.odometer_km) AS effective_km,
    (corr.id IS NOT NULL)                      AS is_corrected,
    corr.reason                                AS correction_reason,
    corr.corrected_by                          AS corrected_by,
    corr.corrected_at                          AS corrected_at
  FROM public.checklists c
  LEFT JOIN LATERAL (
    SELECT oc.id, oc.corrected_km, oc.reason, oc.corrected_by, oc.corrected_at
    FROM public.vehicle_odometer_corrections oc
    WHERE oc.checklist_id = c.id
    ORDER BY oc.corrected_at DESC
    LIMIT 1
  ) corr ON true
  WHERE c.status = 'completed'
    AND c.vehicle_id IS NOT NULL
    AND c.odometer_km IS NOT NULL;

GRANT SELECT ON public.vehicle_odometer_effective_readings TO authenticated;

-- 4) RPC do dashboard passa a usar o KM efetivo (mesmo contrato e mesma regra MAX−MIN).
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
  -- MAX−MIN sobre o KM EFETIVO (correções já aplicadas). Mantém a regra aprovada (2026-06-20).
  SELECT r.vehicle_id,
         (MAX(r.effective_km) - MIN(r.effective_km))::NUMERIC AS km_driven
  FROM public.vehicle_odometer_effective_readings r
  WHERE r.reading_at::date >= p_from
    AND r.reading_at::date <= p_to
    AND (p_client_id IS NULL OR r.client_id = p_client_id)
  GROUP BY r.vehicle_id
  HAVING COUNT(r.effective_km) >= 2
     AND (MAX(r.effective_km) - MIN(r.effective_km)) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_vehicle_km_in_period(UUID, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
