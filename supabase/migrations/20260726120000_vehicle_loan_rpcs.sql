-- ============================================================
-- MIGRATION: vehicle_loan_rpcs
-- Data: 2026-07-26
-- Descrição: RPCs SECURITY DEFINER que centralizam toda a escrita de
--            empréstimos (vehicle_loans) e notificações
--            (vehicle_loan_notifications). A autorização é feita dentro
--            de cada função (papéis/tenant), não só na UI.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- create_vehicle_loan
-- Cria 1 empréstimo ativo + notifica o titular.
-- Restrição de papel: SOMENTE Yard Auditor.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_vehicle_loan(
  p_client_id     UUID,
  p_vehicle_id    UUID,
  p_driver_id     UUID,
  p_checklist_id  UUID,
  p_notes         TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      TEXT;
  v_my_client UUID;
  v_titular   UUID;
  v_temp_name TEXT;
  v_plate     TEXT;
  v_started   TIMESTAMPTZ;
  v_loan_id   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LOAN_NOT_AUTHENTICATED';
  END IF;

  SELECT p.role, p.client_id INTO v_role, v_my_client
  FROM public.profiles p WHERE p.id = auth.uid();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'LOAN_NOT_AUTHENTICATED';
  END IF;

  -- Admin Master isento da checagem de tenant
  IF v_role <> 'Admin Master' THEN
    IF v_my_client IS NULL OR v_my_client <> p_client_id THEN
      RAISE EXCEPTION 'LOAN_INVALID_TENANT';
    END IF;
  END IF;

  -- Restrição de papel: somente Yard Auditor cria empréstimo
  IF v_role <> 'Yard Auditor' THEN
    RAISE EXCEPTION 'LOAN_ONLY_AUDITOR';
  END IF;

  -- Justificativa mínima
  IF char_length(btrim(coalesce(p_notes, ''))) < 10 THEN
    RAISE EXCEPTION 'LOAN_NOTES_TOO_SHORT';
  END IF;

  -- Não pode existir empréstimo ativo para o mesmo veículo
  IF EXISTS (SELECT 1 FROM public.vehicle_loans vl WHERE vl.vehicle_id = p_vehicle_id AND vl.status = 'active') THEN
    RAISE EXCEPTION 'LOAN_ALREADY_ACTIVE';
  END IF;

  -- Titular atual do veículo (pode ser NULL)
  SELECT v.driver_id INTO v_titular FROM public.vehicles v WHERE v.id = p_vehicle_id;

  INSERT INTO public.vehicle_loans (
    client_id, vehicle_id, driver_id, delivery_checklist_id,
    status, notes, created_by, started_at
  ) VALUES (
    p_client_id, p_vehicle_id, p_driver_id, p_checklist_id,
    'active', btrim(p_notes), auth.uid(), NOW()
  )
  RETURNING id INTO v_loan_id;

  -- Notifica o titular (se houver e for diferente do motorista temporário)
  IF v_titular IS NOT NULL AND v_titular <> p_driver_id THEN
    SELECT d.name INTO v_temp_name FROM public.drivers d WHERE d.id = p_driver_id;
    SELECT v.license_plate INTO v_plate FROM public.vehicles v WHERE v.id = p_vehicle_id;
    v_started := NOW();

    INSERT INTO public.vehicle_loan_notifications (
      client_id, loan_id, recipient_driver_id, kind, payload
    ) VALUES (
      p_client_id, v_loan_id, v_titular, 'loan_created',
      jsonb_build_object(
        'license_plate', coalesce(v_plate, ''),
        'temp_driver_name', coalesce(v_temp_name, ''),
        'started_at', to_char(v_started AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'notes', btrim(p_notes)
      )
    );
  END IF;

  RETURN v_loan_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- complete_vehicle_loan
-- Finaliza um empréstimo ativo. Notifica o temporário quando
-- o motivo é 'driver_changed'.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_vehicle_loan(
  p_loan_id            UUID,
  p_return_checklist_id UUID,
  p_ended_reason       TEXT,
  p_ended_by           UUID,
  p_ended_notes        TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan        public.vehicle_loans%ROWTYPE;
  v_my_client   UUID;
  v_my_role     TEXT;
  v_plate       TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LOAN_NOT_AUTHENTICATED';
  END IF;

  SELECT p.role, p.client_id INTO v_my_role, v_my_client
  FROM public.profiles p WHERE p.id = auth.uid();

  SELECT * INTO v_loan FROM public.vehicle_loans WHERE id = p_loan_id;

  IF NOT FOUND OR v_loan.status <> 'active' THEN
    RAISE EXCEPTION 'LOAN_NOT_FOUND_OR_CLOSED';
  END IF;

  IF v_my_role <> 'Admin Master' THEN
    IF v_my_client IS NULL OR v_my_client <> v_loan.client_id THEN
      RAISE EXCEPTION 'LOAN_INVALID_TENANT';
    END IF;
  END IF;

  IF p_ended_reason NOT IN ('return_checklist','driver_changed','cancelled','other') THEN
    RAISE EXCEPTION 'LOAN_INVALID_ENDED_REASON';
  END IF;

  UPDATE public.vehicle_loans
    SET status          = 'completed',
        ended_at        = NOW(),
        return_checklist_id = p_return_checklist_id,
        ended_reason    = p_ended_reason,
        ended_by        = p_ended_by,
        ended_notes     = p_ended_notes,
        updated_at      = NOW()
  WHERE id = p_loan_id;

  -- Notifica o motorista temporário quando a troca de titular finaliza
  IF p_ended_reason = 'driver_changed' THEN
    SELECT v.license_plate INTO v_plate FROM public.vehicles v WHERE v.id = v_loan.vehicle_id;

    INSERT INTO public.vehicle_loan_notifications (
      client_id, loan_id, recipient_driver_id, kind, payload
    ) VALUES (
      v_loan.client_id, v_loan.id, v_loan.driver_id, 'loan_ended_driver_changed',
      jsonb_build_object(
        'license_plate', coalesce(v_plate, ''),
        'ended_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'reason', p_ended_reason,
        'notes', coalesce(p_ended_notes, '')
      )
    );
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- get_active_vehicle_loan
-- Retorna o empréstimo ativo do veículo + nome do motorista (JOIN).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_vehicle_loan(
  p_vehicle_id UUID
) RETURNS TABLE (
  id                   UUID,
  client_id            UUID,
  vehicle_id           UUID,
  driver_id            UUID,
  driver_name         TEXT,
  started_at           TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  delivery_checklist_id UUID,
  return_checklist_id   UUID,
  status                TEXT,
  notes                 TEXT,
  ended_notes           TEXT,
  created_by           UUID,
  ended_by             UUID,
  ended_reason         TEXT,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ
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
    d.name                AS driver_name,
    vl.started_at,
    vl.ended_at,
    vl.delivery_checklist_id,
    vl.return_checklist_id,
    vl.status,
    vl.notes,
    vl.ended_notes,
    vl.created_by,
    vl.ended_by,
    vl.ended_reason,
    vl.created_at,
    vl.updated_at
  FROM public.vehicle_loans vl
  LEFT JOIN public.drivers d ON d.id = vl.driver_id
  WHERE vl.vehicle_id = p_vehicle_id
    AND vl.status = 'active'
    AND (
      vl.client_id = public.get_my_client_id()
      OR public.get_my_role() = 'Admin Master'
    );
$$;

-- ────────────────────────────────────────────────────────────────
-- mark_vehicle_loan_notification_read
-- Marca 1 notificação como lida (somente o motorista destinatário).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_vehicle_loan_notification_read(
  p_notification_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_profile   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LOAN_NOT_AUTHENTICATED';
  END IF;

  SELECT n.recipient_driver_id INTO v_recipient
  FROM public.vehicle_loan_notifications n
  WHERE n.id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOAN_NOTIFICATION_NOT_FOUND';
  END IF;

  SELECT d.profile_id INTO v_profile FROM public.drivers d WHERE d.id = v_recipient;

  IF v_profile IS NULL OR v_profile <> auth.uid() THEN
    RAISE EXCEPTION 'LOAN_NOTIFICATION_FORBIDDEN';
  END IF;

  UPDATE public.vehicle_loan_notifications
    SET read_at = NOW()
  WHERE id = p_notification_id AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_vehicle_loan(UUID, UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_vehicle_loan(UUID, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_vehicle_loan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_vehicle_loan_notification_read(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';