-- Chamados/S.O.S. — evolução: número do chamado, Km, snapshots do veículo e trava de criticidade
-- Aditiva: nenhuma coluna removida, nenhuma renomeada, nenhum dado existente alterado.

-- ─── 1. Colunas novas em fleet_tickets ───────────────────────

ALTER TABLE public.fleet_tickets
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS odometer_km numeric,
  ADD COLUMN IF NOT EXISTS vehicle_model_snapshot text,
  ADD COLUMN IF NOT EXISTS vehicle_owner_snapshot text,
  ADD COLUMN IF NOT EXISTS shipper_name_snapshot text,
  ADD COLUMN IF NOT EXISTS operational_unit_name_snapshot text;

DO $$ BEGIN
  ALTER TABLE public.fleet_tickets
    ADD CONSTRAINT fleet_tickets_odometer_km_positive
    CHECK (odometer_km IS NULL OR odometer_km >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Índice único parcial do número do chamado ────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_tickets_client_number
  ON public.fleet_tickets(client_id, ticket_number)
  WHERE ticket_number IS NOT NULL;

-- ─── 3. Função geradora do número do chamado ─────────────────

CREATE OR REPLACE FUNCTION public.generate_fleet_ticket_number(p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt int := 0;
  v_candidate text;
BEGIN
  WHILE v_attempt < 10 LOOP
    v_candidate := 'CH-' || to_char(now(), 'YYMM') || '-'
      || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');

    IF NOT EXISTS (
      SELECT 1 FROM public.fleet_tickets
      WHERE client_id = p_client_id AND ticket_number = v_candidate
    ) THEN
      RETURN v_candidate;
    END IF;

    v_attempt := v_attempt + 1;
  END LOOP;

  RAISE EXCEPTION 'Não foi possível gerar o número do chamado. Tente novamente.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_fleet_ticket_number(uuid) TO authenticated;

-- ─── 4. RPC: criar S.O.S. — nova assinatura (+ p_odometer_km) ─

DROP FUNCTION IF EXISTS public.create_sos_ticket(uuid, text, text, text, double precision, double precision, text);

CREATE OR REPLACE FUNCTION public.create_sos_ticket(
  p_vehicle_id uuid,
  p_sos_type text,
  p_description text,
  p_location_text text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_status text,
  p_odometer_km numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_role text;
  v_client_id uuid;
  v_name text;
  v_driver_id uuid;
  v_driver_name text;
  v_plate text;
  v_model text;
  v_owner text;
  v_shipper_name text;
  v_unit_name text;
  v_ticket_number text;
  v_ticket_id uuid;
  v_title text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT p.role, p.client_id, p.name
    INTO v_role, v_client_id, v_name
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado.';
  END IF;

  IF v_role <> 'Driver' THEN
    RAISE EXCEPTION 'Somente motoristas podem abrir S.O.S.';
  END IF;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Motorista sem cliente associado.';
  END IF;

  IF p_odometer_km IS NULL OR p_odometer_km < 0 THEN
    RAISE EXCEPTION 'Informe o Km atual do veículo.';
  END IF;

  IF p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Selecione um veículo.';
  END IF;

  SELECT d.id, d.name
    INTO v_driver_id, v_driver_name
  FROM public.drivers d
  WHERE d.profile_id = v_caller_id
    AND d.client_id = v_client_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado para o usuário autenticado.';
  END IF;

  SELECT v.license_plate, v.model, v.owner, s.name, ou.name
    INTO v_plate, v_model, v_owner, v_shipper_name, v_unit_name
  FROM public.vehicles v
  LEFT JOIN public.shippers s ON s.id = v.shipper_id
  LEFT JOIN public.operational_units ou ON ou.id = v.operational_unit_id
  WHERE v.id = p_vehicle_id
    AND v.client_id = v_client_id;

  IF v_plate IS NULL THEN
    RAISE EXCEPTION 'Veículo inválido para o cliente do motorista.';
  END IF;

  IF NULLIF(BTRIM(p_sos_type), '') IS NULL
     OR p_sos_type NOT IN ('breakdown', 'collision', 'theft') THEN
    RAISE EXCEPTION 'Tipo de S.O.S. inválido.';
  END IF;

  v_title := CASE p_sos_type
    WHEN 'breakdown' THEN 'S.O.S. — Veículo enguiçado'
    WHEN 'collision' THEN 'S.O.S. — Colisão/Sinistro'
    WHEN 'theft' THEN 'S.O.S. — Roubo do veículo'
  END;

  v_ticket_number := public.generate_fleet_ticket_number(v_client_id);

  INSERT INTO public.fleet_tickets (
    client_id,
    source,
    opened_by,
    opened_by_role,
    opened_by_name_snapshot,
    driver_id,
    driver_name_snapshot,
    vehicle_id,
    vehicle_license_plate_snapshot,
    sos_type,
    title,
    description,
    criticality,
    status,
    latitude,
    longitude,
    location_status,
    location_text,
    ticket_number,
    odometer_km,
    vehicle_model_snapshot,
    vehicle_owner_snapshot,
    shipper_name_snapshot,
    operational_unit_name_snapshot
  )
  VALUES (
    v_client_id,
    'sos',
    v_caller_id,
    v_role,
    v_name,
    v_driver_id,
    v_driver_name,
    p_vehicle_id,
    v_plate,
    p_sos_type,
    v_title,
    NULLIF(BTRIM(p_description), ''),
    'critical',
    'open',
    p_latitude,
    p_longitude,
    p_location_status,
    NULLIF(BTRIM(p_location_text), ''),
    v_ticket_number,
    p_odometer_km,
    v_model,
    v_owner,
    v_shipper_name,
    v_unit_name
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_client_id, v_ticket_id, 'created', v_caller_id, v_name,
    jsonb_build_object('source', 'sos', 'sos_type', p_sos_type)
  );

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sos_ticket(uuid, text, text, text, double precision, double precision, text, numeric)
  TO authenticated;

-- ─── 5. RPC: criar chamado comum — nova assinatura ───────────

DROP FUNCTION IF EXISTS public.create_fleet_ticket_report(uuid, text, text);

CREATE OR REPLACE FUNCTION public.create_fleet_ticket_report(
  p_vehicle_id uuid,
  p_title text,
  p_description text,
  p_odometer_km numeric,
  p_criticality text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_role text;
  v_client_id uuid;
  v_name text;
  v_vehicle_client_id uuid;
  v_plate text;
  v_model text;
  v_owner text;
  v_shipper_name text;
  v_unit_name text;
  v_ticket_number text;
  v_ticket_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT p.role, p.client_id, p.name
    INTO v_role, v_client_id, v_name
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado.';
  END IF;

  IF NOT (
    v_role IN ('Yard Auditor', 'Operations Manager')
    OR (v_role <> 'Operations Manager' AND public.role_rank(v_role) >= public.role_rank('Fleet Assistant'))
    OR v_role = 'Admin Master'
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para abrir chamados.';
  END IF;

  IF p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Selecione um veículo.';
  END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o título do chamado.';
  END IF;
  IF NULLIF(BTRIM(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a descrição do chamado.';
  END IF;

  IF p_odometer_km IS NULL OR p_odometer_km < 0 THEN
    RAISE EXCEPTION 'Informe o Km atual do veículo.';
  END IF;

  IF p_criticality IS NULL OR p_criticality NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Selecione a criticidade do chamado.';
  END IF;

  SELECT v.client_id, v.license_plate, v.model, v.owner, s.name, ou.name
    INTO v_vehicle_client_id, v_plate, v_model, v_owner, v_shipper_name, v_unit_name
  FROM public.vehicles v
  LEFT JOIN public.shippers s ON s.id = v.shipper_id
  LEFT JOIN public.operational_units ou ON ou.id = v.operational_unit_id
  WHERE v.id = p_vehicle_id;

  IF v_vehicle_client_id IS NULL THEN
    RAISE EXCEPTION 'Veículo não encontrado.';
  END IF;

  IF v_role <> 'Admin Master' AND v_vehicle_client_id IS DISTINCT FROM v_client_id THEN
    RAISE EXCEPTION 'Veículo fora do tenant do usuário.';
  END IF;

  IF v_role = 'Operations Manager'
     AND NOT public.operations_manager_can_access_vehicle_id(v_caller_id, p_vehicle_id) THEN
    RAISE EXCEPTION 'Veículo fora do escopo operacional do usuário.';
  END IF;

  v_ticket_number := public.generate_fleet_ticket_number(v_vehicle_client_id);

  INSERT INTO public.fleet_tickets (
    client_id,
    source,
    opened_by,
    opened_by_role,
    opened_by_name_snapshot,
    vehicle_id,
    vehicle_license_plate_snapshot,
    title,
    description,
    criticality,
    status,
    ticket_number,
    odometer_km,
    vehicle_model_snapshot,
    vehicle_owner_snapshot,
    shipper_name_snapshot,
    operational_unit_name_snapshot,
    classified_by,
    classified_by_name_snapshot,
    classified_at
  )
  VALUES (
    v_vehicle_client_id,
    'report',
    v_caller_id,
    v_role,
    v_name,
    p_vehicle_id,
    v_plate,
    BTRIM(p_title),
    BTRIM(p_description),
    p_criticality,
    'open',
    v_ticket_number,
    p_odometer_km,
    v_model,
    v_owner,
    v_shipper_name,
    v_unit_name,
    v_caller_id,
    v_name,
    now()
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_vehicle_client_id, v_ticket_id, 'created', v_caller_id, v_name,
    jsonb_build_object('source', 'report', 'criticality', p_criticality)
  );

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_fleet_ticket_report(uuid, text, text, numeric, text)
  TO authenticated;

-- ─── 6. RPC: classificar — trava de permissão corrigida ──────

CREATE OR REPLACE FUNCTION public.classify_fleet_ticket(
  p_ticket_id uuid,
  p_criticality text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_role text;
  v_client_id uuid;
  v_name text;
  v_ticket public.fleet_tickets%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT p.role, p.client_id, p.name
    INTO v_role, v_client_id, v_name
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_role IS NULL
     OR (
       v_role <> 'Admin Master'
       AND (
         v_role = 'Operations Manager'
         OR public.role_rank(v_role) < public.role_rank('Fleet Assistant')
       )
     ) THEN
    RAISE EXCEPTION 'Apenas o time de Frota (Fleet Assistant ou superior) pode alterar a criticidade do chamado.';
  END IF;

  IF p_criticality IS NULL OR p_criticality NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Criticidade inválida.';
  END IF;

  SELECT * INTO v_ticket
  FROM public.fleet_tickets ft
  WHERE ft.id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  IF v_role <> 'Admin Master' AND v_ticket.client_id IS DISTINCT FROM v_client_id THEN
    RAISE EXCEPTION 'Chamado fora do tenant do usuário.';
  END IF;

  IF v_ticket.status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Não é possível classificar um chamado encerrado ou cancelado.';
  END IF;

  IF v_ticket.source = 'sos' AND p_criticality <> 'critical' THEN
    RAISE EXCEPTION 'S.O.S. deve permanecer com criticidade crítica.';
  END IF;

  UPDATE public.fleet_tickets
  SET criticality = CASE WHEN source = 'report' THEN p_criticality ELSE criticality END,
      classified_by = CASE WHEN source = 'report' THEN v_caller_id ELSE classified_by END,
      classified_by_name_snapshot = CASE WHEN source = 'report' THEN v_name ELSE classified_by_name_snapshot END,
      classified_at = CASE WHEN source = 'report' THEN now() ELSE classified_at END,
      status = CASE WHEN status = 'open' THEN 'in_analysis' ELSE status END,
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_ticket.client_id,
    p_ticket_id,
    'classified',
    v_caller_id,
    v_name,
    jsonb_build_object('criticality', p_criticality)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.classify_fleet_ticket(uuid, text)
  TO authenticated;

-- ─── 7. Reload do schema PostgREST ────────────────────────────

NOTIFY pgrst, 'reload schema';
