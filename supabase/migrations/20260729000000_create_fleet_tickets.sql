-- ============================================================
-- MIGRATION: create_fleet_tickets
-- Descrição: módulo de Chamados/S.O.S. com criticidade,
--            histórico de eventos e Telegram configurável por tenant.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ⚠️ Esta migration não altera action_plans nem módulos existentes.
-- ============================================================

-- ─── 1. Tabelas ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fleet_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  source text NOT NULL CHECK (source IN ('sos', 'report')),
  opened_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_by_role text NOT NULL,
  opened_by_name_snapshot text NOT NULL,

  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name_snapshot text,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  vehicle_license_plate_snapshot text NOT NULL,

  sos_type text CHECK (sos_type IN ('breakdown', 'collision', 'theft')),
  title text NOT NULL,
  description text,

  criticality text CHECK (criticality IN ('critical', 'high', 'medium', 'low')),
  classified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  classified_by_name_snapshot text,
  classified_at timestamptz,

  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_analysis', 'in_progress', 'resolved', 'closed', 'cancelled')),

  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to_name_snapshot text,
  assigned_at timestamptz,

  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by_name_snapshot text,
  resolved_at timestamptz,
  resolution_notes text,

  latitude double precision,
  longitude double precision,
  location_status text CHECK (location_status IN ('captured', 'denied', 'unavailable', 'manual')),
  location_text text,

  attachment_paths text[] NOT NULL DEFAULT '{}',
  telegram_notified_at timestamptz,
  telegram_last_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fleet_tickets_sos_shape CHECK (
    (source = 'sos' AND sos_type IS NOT NULL AND criticality = 'critical' AND driver_id IS NOT NULL)
    OR
    (source = 'report' AND sos_type IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.fleet_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.fleet_tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created',
    'attachments_added',
    'classified',
    'assigned',
    'status_changed',
    'telegram_sent',
    'telegram_failed'
  )),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_telegram_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  chat_id text,
  notify_sos boolean NOT NULL DEFAULT true,
  notify_critical boolean NOT NULL DEFAULT true,
  notify_high boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_telegram_settings_enabled_chat_check CHECK (
    enabled = false OR NULLIF(BTRIM(chat_id), '') IS NOT NULL
  )
);

-- ─── 2. Índices ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fleet_tickets_client_created
  ON public.fleet_tickets(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_client_status
  ON public.fleet_tickets(client_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_client_criticality
  ON public.fleet_tickets(client_id, criticality);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_source
  ON public.fleet_tickets(client_id, source);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_vehicle
  ON public.fleet_tickets(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_opened_by
  ON public.fleet_tickets(opened_by);
CREATE INDEX IF NOT EXISTS idx_fleet_ticket_events_ticket
  ON public.fleet_ticket_events(ticket_id, created_at DESC);

-- ─── 3. RLS ─────────────────────────────────────────────────

ALTER TABLE public.fleet_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_telegram_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_tickets_select ON public.fleet_tickets;
CREATE POLICY fleet_tickets_select
  ON public.fleet_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND (
        (
          public.get_my_role() <> 'Operations Manager'
          AND public.get_my_role() <> 'Driver'
          AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
        )
        OR public.get_my_role() = 'Yard Auditor'
        OR (
          public.get_my_role() = 'Operations Manager'
          AND (
            public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
            OR opened_by = auth.uid()
          )
        )
        OR (
          public.get_my_role() = 'Driver'
          AND source = 'sos'
          AND opened_by = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS fleet_ticket_events_select ON public.fleet_ticket_events;
CREATE POLICY fleet_ticket_events_select
  ON public.fleet_ticket_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fleet_tickets ft
      WHERE ft.id = fleet_ticket_events.ticket_id
        AND (
          public.is_admin_master()
          OR (
            ft.client_id = public.get_my_client_id()
            AND (
              (
                public.get_my_role() <> 'Operations Manager'
                AND public.get_my_role() <> 'Driver'
                AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
              )
              OR public.get_my_role() = 'Yard Auditor'
              OR (
                public.get_my_role() = 'Operations Manager'
                AND (
                  public.operations_manager_can_access_vehicle_id(auth.uid(), ft.vehicle_id)
                  OR ft.opened_by = auth.uid()
                )
              )
              OR (
                public.get_my_role() = 'Driver'
                AND ft.source = 'sos'
                AND ft.opened_by = auth.uid()
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS client_telegram_settings_select ON public.client_telegram_settings;
CREATE POLICY client_telegram_settings_select
  ON public.client_telegram_settings
  FOR SELECT TO authenticated
  USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  );

DROP POLICY IF EXISTS client_telegram_settings_insert ON public.client_telegram_settings;
CREATE POLICY client_telegram_settings_insert
  ON public.client_telegram_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  );

DROP POLICY IF EXISTS client_telegram_settings_update ON public.client_telegram_settings;
CREATE POLICY client_telegram_settings_update
  ON public.client_telegram_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  )
  WITH CHECK (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.get_my_role() IN ('Coordinator', 'Manager', 'Director')
    )
  );

-- ─── 4. Storage privado ─────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('fleet-ticket-attachments', 'fleet-ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Fleet ticket attachments select" ON storage.objects;
CREATE POLICY "Fleet ticket attachments select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fleet-ticket-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = 'fleet-tickets'
    AND (
      public.is_admin_master()
      OR (
        (storage.foldername(name))[1] = public.get_my_client_id()::text
        AND (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND EXISTS (
          SELECT 1
          FROM public.fleet_tickets ft
          WHERE ft.id = (storage.foldername(name))[3]::uuid
            AND (
              (
                public.get_my_role() <> 'Operations Manager'
                AND public.get_my_role() <> 'Driver'
                AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
              )
              OR public.get_my_role() = 'Yard Auditor'
              OR (
                public.get_my_role() = 'Operations Manager'
                AND (
                  public.operations_manager_can_access_vehicle_id(auth.uid(), ft.vehicle_id)
                  OR ft.opened_by = auth.uid()
                )
              )
              OR (
                public.get_my_role() = 'Driver'
                AND ft.source = 'sos'
                AND ft.opened_by = auth.uid()
              )
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Fleet ticket attachments insert" ON storage.objects;
CREATE POLICY "Fleet ticket attachments insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fleet-ticket-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = 'fleet-tickets'
    AND (
      public.is_admin_master()
      OR (storage.foldername(name))[1] = public.get_my_client_id()::text
    )
    AND (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.fleet_tickets ft
      WHERE ft.id = (storage.foldername(name))[3]::uuid
        AND (
          public.is_admin_master()
          OR (
            ft.client_id = (storage.foldername(name))[1]::uuid
            AND ft.client_id = public.get_my_client_id()
            AND (
              ft.opened_by = auth.uid()
              OR (
                public.get_my_role() <> 'Operations Manager'
                AND public.get_my_role() <> 'Driver'
                AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
              )
            )
          )
        )
    )
  );

-- ─── 5. Funções auxiliares internas ─────────────────────────

-- As validações de caller são mantidas dentro de cada RPC para que
-- cada operação tenha uma única fronteira SECURITY DEFINER explícita.

-- ─── 6. RPC: criar S.O.S. ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_sos_ticket(
  p_vehicle_id uuid,
  p_sos_type text,
  p_description text,
  p_location_text text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_status text
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

  SELECT v.license_plate
    INTO v_plate
  FROM public.vehicles v
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
    location_text
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
    NULLIF(BTRIM(p_location_text), '')
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

GRANT EXECUTE ON FUNCTION public.create_sos_ticket(uuid, text, text, text, double precision, double precision, text)
  TO authenticated;

-- ─── 7. RPC: criar chamado comum ────────────────────────────

CREATE OR REPLACE FUNCTION public.create_fleet_ticket_report(
  p_vehicle_id uuid,
  p_title text,
  p_description text
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

  SELECT v.client_id, v.license_plate
    INTO v_vehicle_client_id, v_plate
  FROM public.vehicles v
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
    status
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
    NULL,
    'open'
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_vehicle_client_id, v_ticket_id, 'created', v_caller_id, v_name,
    jsonb_build_object('source', 'report')
  );

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_fleet_ticket_report(uuid, text, text)
  TO authenticated;

-- ─── 8. RPC: anexos ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.append_fleet_ticket_attachments(
  p_ticket_id uuid,
  p_attachment_paths text[]
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
  v_path text;
  v_paths text[];
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT p.role, p.client_id, p.name
    INTO v_role, v_client_id, v_name
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  SELECT * INTO v_ticket
  FROM public.fleet_tickets ft
  WHERE ft.id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  IF v_role <> 'Admin Master'
     AND (
       v_ticket.client_id IS DISTINCT FROM v_client_id
       OR (
         v_ticket.opened_by <> v_caller_id
         AND NOT (
           v_role <> 'Operations Manager'
           AND v_role <> 'Driver'
           AND public.role_rank(v_role) >= public.role_rank('Fleet Assistant')
         )
       )
     ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para anexar arquivos neste chamado.';
  END IF;

  IF v_ticket.status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Não é possível anexar arquivos a um chamado encerrado ou cancelado.';
  END IF;

  v_paths := COALESCE(p_attachment_paths, '{}'::text[]);
  FOREACH v_path IN ARRAY v_paths LOOP
    IF v_path IS NULL
       OR v_path NOT LIKE v_ticket.client_id::text || '/fleet-tickets/' || p_ticket_id::text || '/%' THEN
      RAISE EXCEPTION 'Caminho de anexo inválido para este chamado.';
    END IF;
  END LOOP;

  UPDATE public.fleet_tickets ft
  SET attachment_paths = ARRAY(
        SELECT DISTINCT path
        FROM unnest(COALESCE(ft.attachment_paths, '{}'::text[]) || v_paths) AS path
      ),
      updated_at = now()
  WHERE ft.id = p_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_ticket.client_id,
    p_ticket_id,
    'attachments_added',
    v_caller_id,
    v_name,
    jsonb_build_object('count', cardinality(v_paths))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_fleet_ticket_attachments(uuid, text[])
  TO authenticated;

-- ─── 9. RPC: classificar ─────────────────────────────────────

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

  IF v_role IS NULL OR v_role <> 'Admin Master' AND public.role_rank(v_role) < public.role_rank('Fleet Analyst') THEN
    RAISE EXCEPTION 'Usuário sem permissão para classificar chamados.';
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

-- ─── 10. RPC: assumir atendimento ───────────────────────────

CREATE OR REPLACE FUNCTION public.assign_fleet_ticket_to_self(
  p_ticket_id uuid
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
     OR v_role = 'Operations Manager'
     OR (v_role <> 'Admin Master' AND public.role_rank(v_role) < public.role_rank('Fleet Assistant')) THEN
    RAISE EXCEPTION 'Usuário sem permissão para assumir chamados.';
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

  IF v_ticket.status IN ('resolved', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Não é possível assumir um chamado resolvido, encerrado ou cancelado.';
  END IF;

  UPDATE public.fleet_tickets
  SET assigned_to = v_caller_id,
      assigned_to_name_snapshot = v_name,
      assigned_at = now(),
      status = 'in_progress',
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_ticket.client_id,
    p_ticket_id,
    'assigned',
    v_caller_id,
    v_name,
    jsonb_build_object('assigned_to', v_caller_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_fleet_ticket_to_self(uuid)
  TO authenticated;

-- ─── 11. RPC: status operacional ────────────────────────────

CREATE OR REPLACE FUNCTION public.update_fleet_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_resolution_notes text
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
     OR v_role = 'Operations Manager'
     OR (v_role <> 'Admin Master' AND public.role_rank(v_role) < public.role_rank('Fleet Assistant')) THEN
    RAISE EXCEPTION 'Usuário sem permissão para alterar o status de chamados.';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('in_analysis', 'in_progress', 'resolved', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'Status de chamado inválido.';
  END IF;

  IF p_status = 'resolved' AND LENGTH(BTRIM(COALESCE(p_resolution_notes, ''))) < 5 THEN
    RAISE EXCEPTION 'Informe notas de resolução com pelo menos 5 caracteres.';
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

  UPDATE public.fleet_tickets
  SET status = p_status,
      resolution_notes = CASE WHEN p_status = 'resolved' THEN BTRIM(p_resolution_notes) ELSE resolution_notes END,
      resolved_by = CASE WHEN p_status = 'resolved' THEN v_caller_id ELSE resolved_by END,
      resolved_by_name_snapshot = CASE WHEN p_status = 'resolved' THEN v_name ELSE resolved_by_name_snapshot END,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE resolved_at END,
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.fleet_ticket_events (
    client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
  )
  VALUES (
    v_ticket.client_id,
    p_ticket_id,
    'status_changed',
    v_caller_id,
    v_name,
    jsonb_build_object('from', v_ticket.status, 'to', p_status)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_fleet_ticket_status(uuid, text, text)
  TO authenticated;

-- ─── 12. RPC: resultado do Telegram ─────────────────────────

CREATE OR REPLACE FUNCTION public.record_fleet_ticket_telegram_result(
  p_ticket_id uuid,
  p_success boolean,
  p_error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.fleet_tickets%ROWTYPE;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
BEGIN
  SELECT * INTO v_ticket
  FROM public.fleet_tickets ft
  WHERE ft.id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  SELECT p.name INTO v_actor_name
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF COALESCE(p_success, false) THEN
    UPDATE public.fleet_tickets
    SET telegram_notified_at = now(),
        telegram_last_error = NULL,
        updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO public.fleet_ticket_events (
      client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
    )
    VALUES (
      v_ticket.client_id, p_ticket_id, 'telegram_sent', v_actor_id,
      COALESCE(v_actor_name, 'Telegram'), '{}'::jsonb
    );
  ELSE
    UPDATE public.fleet_tickets
    SET telegram_last_error = LEFT(COALESCE(p_error, 'Falha ao enviar notificação Telegram.'), 500),
        updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO public.fleet_ticket_events (
      client_id, ticket_id, event_type, actor_id, actor_name_snapshot, payload
    )
    VALUES (
      v_ticket.client_id, p_ticket_id, 'telegram_failed', v_actor_id,
      COALESCE(v_actor_name, 'Telegram'),
      jsonb_build_object('error', LEFT(COALESCE(p_error, 'Falha ao enviar notificação Telegram.'), 500))
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_fleet_ticket_telegram_result(uuid, boolean, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
