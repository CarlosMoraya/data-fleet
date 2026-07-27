-- ============================================================
-- MIGRATION: vehicle_loan_history_names
-- Data: 2026-07-26
-- Descrição: Resolve nomes (created_by/ended_by) e datas de checklist
--            (delivery/return) no histórico de empréstimos via RPC
--            SECURITY DEFINER. Necessário porque o histórico também é
--            visível ao Yard Auditor (rank 1), que a RLS de profiles
--            bloqueia (mesmo problema do MEMORY 2026-07-24). A
--            resolução de nomes DEVE ser no banco, não no cliente.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- get_vehicle_loans_by_vehicle
-- Retorna TODO o histórico de empréstimos do veículo + nomes + datas
-- de checklists associados. Tenant do chamador; Admin Master isento.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_vehicle_loans_by_vehicle(
  p_vehicle_id UUID
) RETURNS TABLE (
  id                    UUID,
  client_id             UUID,
  vehicle_id            UUID,
  driver_id             UUID,
  driver_name           TEXT,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  delivery_checklist_id UUID,
  return_checklist_id   UUID,
  status                TEXT,
  notes                 TEXT,
  ended_notes           TEXT,
  created_by            UUID,
  created_by_name       TEXT,
  ended_by              UUID,
  ended_by_name         TEXT,
  ended_reason          TEXT,
  delivery_checklist_at TIMESTAMPTZ,
  return_checklist_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vl.id,
    vl.client_id,
    vl.vehicle_id,
    vl.driver_id,
    d.name                 AS driver_name,
    vl.started_at,
    vl.ended_at,
    vl.delivery_checklist_id,
    vl.return_checklist_id,
    vl.status,
    vl.notes,
    vl.ended_notes,
    vl.created_by,
    pc.name                AS created_by_name,
    vl.ended_by,
    pe.name                AS ended_by_name,
    vl.ended_reason,
    COALESCE(dc.completed_at, dc.started_at) AS delivery_checklist_at,
    COALESCE(rc.completed_at, rc.started_at) AS return_checklist_at,
    vl.created_at,
    vl.updated_at
  FROM public.vehicle_loans vl
  LEFT JOIN public.drivers    d  ON d.id  = vl.driver_id
  LEFT JOIN public.profiles   pc ON pc.id = vl.created_by
  LEFT JOIN public.profiles   pe ON pe.id = vl.ended_by
  LEFT JOIN public.checklists dc ON dc.id = vl.delivery_checklist_id
  LEFT JOIN public.checklists rc ON rc.id = vl.return_checklist_id
  WHERE vl.vehicle_id = p_vehicle_id
    AND (
      vl.client_id = public.get_my_client_id()
      OR public.get_my_role() = 'Admin Master'
    )
  ORDER BY vl.started_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_vehicle_loans_by_vehicle(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- get_active_vehicle_loan (REPLACE)
-- Acresenta created_by_name, ended_by_name, delivery_checklist_at e
-- return_checklist_at ao retorno. Lógica de filtro (status='active')
-- e isolamento por tenant permanecem idênticos.
-- ────────────────────────────────────────────────────────────────
-- ⚠️ DROP necessário: CREATE OR REPLACE não pode mudar o tipo de retorno
-- (OUT params). O DROP remove GRANTs — re-GRANT ao final.
DROP FUNCTION IF EXISTS public.get_active_vehicle_loan(UUID);

CREATE FUNCTION public.get_active_vehicle_loan(
  p_vehicle_id UUID
) RETURNS TABLE (
  id                    UUID,
  client_id             UUID,
  vehicle_id            UUID,
  driver_id             UUID,
  driver_name           TEXT,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  delivery_checklist_id UUID,
  return_checklist_id   UUID,
  status                TEXT,
  notes                 TEXT,
  ended_notes           TEXT,
  created_by            UUID,
  created_by_name       TEXT,
  ended_by              UUID,
  ended_by_name         TEXT,
  ended_reason          TEXT,
  delivery_checklist_at TIMESTAMPTZ,
  return_checklist_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vl.id,
    vl.client_id,
    vl.vehicle_id,
    vl.driver_id,
    d.name                 AS driver_name,
    vl.started_at,
    vl.ended_at,
    vl.delivery_checklist_id,
    vl.return_checklist_id,
    vl.status,
    vl.notes,
    vl.ended_notes,
    vl.created_by,
    pc.name                AS created_by_name,
    vl.ended_by,
    pe.name                AS ended_by_name,
    vl.ended_reason,
    COALESCE(dc.completed_at, dc.started_at) AS delivery_checklist_at,
    COALESCE(rc.completed_at, rc.started_at) AS return_checklist_at,
    vl.created_at,
    vl.updated_at
  FROM public.vehicle_loans vl
  LEFT JOIN public.drivers    d  ON d.id  = vl.driver_id
  LEFT JOIN public.profiles   pc ON pc.id = vl.created_by
  LEFT JOIN public.profiles   pe ON pe.id = vl.ended_by
  LEFT JOIN public.checklists dc ON dc.id = vl.delivery_checklist_id
  LEFT JOIN public.checklists rc ON rc.id = vl.return_checklist_id
  WHERE vl.vehicle_id = p_vehicle_id
    AND vl.status = 'active'
    AND (
      vl.client_id = public.get_my_client_id()
      OR public.get_my_role() = 'Admin Master'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_active_vehicle_loan(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';