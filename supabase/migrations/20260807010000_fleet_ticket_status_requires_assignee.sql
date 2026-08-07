-- Correção de escopo: por questão de auditoria, qualquer alteração de status
-- (não apenas 'resolved'/'closed') deve exigir que alguém tenha assumido o
-- chamado antes. Substitui a trava introduzida em 20260807000000_fleet_ticket_sla.sql.

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

  IF v_ticket.assigned_to IS NULL THEN
    RAISE EXCEPTION 'Assuma o atendimento antes de alterar o status deste chamado.';
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
