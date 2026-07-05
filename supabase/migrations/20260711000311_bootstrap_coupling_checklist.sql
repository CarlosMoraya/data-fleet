CREATE OR REPLACE FUNCTION public.bootstrap_coupling_checklist(
  p_template_id uuid,
  p_action text,
  p_trailer_plate text,
  p_tractor_plate text,
  p_tractor_driver_name text,
  p_device_info text DEFAULT NULL
)
RETURNS TABLE(
  checklist_id uuid,
  trailer_id uuid,
  tractor_id uuid,
  third_party_tractor_id uuid,
  third_party_driver_id uuid,
  open_coupling_id uuid,
  open_coupling_odometer numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_client_id uuid;
  caller_role text;
  resolved_trailer_id uuid;
  resolved_tractor_id uuid;
  resolved_third_party_tractor_id uuid;
  resolved_third_party_driver_id uuid;
  resolved_open_coupling_id uuid;
  resolved_open_coupling_odometer numeric;
  resolved_checklist_id uuid;
  template_version_number integer;
BEGIN
  SELECT client_id, role
  INTO caller_client_id, caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_client_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF caller_role <> 'Coupling Agent' AND public.role_rank(caller_role) < 3 THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF upper(btrim(coalesce(p_action, ''))) NOT IN ('ENGATE', 'DESENGATE') THEN
    RAISE EXCEPTION 'Ação inválida.';
  END IF;

  IF length(upper(btrim(coalesce(p_trailer_plate, '')))) <> 7 THEN
    RAISE EXCEPTION 'Placa da carreta inválida.';
  END IF;

  IF length(upper(btrim(coalesce(p_tractor_plate, '')))) <> 7 THEN
    RAISE EXCEPTION 'Placa do cavalo inválida.';
  END IF;

  IF btrim(coalesce(p_tractor_driver_name, '')) = '' THEN
    RAISE EXCEPTION 'Nome do condutor é obrigatório.';
  END IF;

  SELECT current_version
  INTO template_version_number
  FROM public.checklist_templates
  WHERE id = p_template_id
    AND client_id = caller_client_id
    AND vehicle_category = 'Semi-reboque/Implemento'
    AND context = initcap(lower(btrim(p_action)))
    AND status = 'published';

  IF template_version_number IS NULL THEN
    RAISE EXCEPTION 'Template inválido para esta ação.';
  END IF;

  SELECT v.id
  INTO resolved_trailer_id
  FROM public.vehicles v
  WHERE v.client_id = caller_client_id
    AND upper(v.license_plate) = upper(btrim(p_trailer_plate))
    AND v.type IN ('Semirreboque', 'Reboque', 'Dolly')
  LIMIT 1;

  IF resolved_trailer_id IS NULL THEN
    RAISE EXCEPTION 'Carreta não localizada para iniciar o checklist.';
  END IF;

  IF initcap(lower(btrim(p_action))) = 'Engate' THEN
    IF EXISTS (
      SELECT 1
      FROM public.vehicle_couplings vc
      WHERE vc.trailer_id = resolved_trailer_id
        AND vc.uncoupled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'A carreta já possui engate aberto.';
    END IF;
  ELSE
    SELECT vc.id, vc.odometer_coupled
    INTO resolved_open_coupling_id, resolved_open_coupling_odometer
    FROM public.vehicle_couplings vc
    WHERE vc.client_id = caller_client_id
      AND vc.trailer_id = resolved_trailer_id
      AND vc.uncoupled_at IS NULL
    LIMIT 1;

    IF resolved_open_coupling_id IS NULL THEN
      RAISE EXCEPTION 'Nenhum engate aberto foi encontrado para esta carreta.';
    END IF;
  END IF;

  SELECT v.id
  INTO resolved_tractor_id
  FROM public.vehicles v
  WHERE v.client_id = caller_client_id
    AND upper(v.license_plate) = upper(btrim(p_tractor_plate))
    AND v.type = 'Cavalo'
  LIMIT 1;

  IF resolved_tractor_id IS NULL THEN
    INSERT INTO public.third_party_tractor (
      client_id,
      plate,
      updated_at
    )
    VALUES (
      caller_client_id,
      upper(btrim(p_tractor_plate)),
      now()
    )
    ON CONFLICT (client_id, plate) DO UPDATE
      SET updated_at = now()
    RETURNING id
    INTO resolved_third_party_tractor_id;

    INSERT INTO public.third_party_driver (
      client_id,
      name
    )
    VALUES (
      caller_client_id,
      btrim(p_tractor_driver_name)
    )
    RETURNING id
    INTO resolved_third_party_driver_id;
  END IF;

  INSERT INTO public.checklists (
    client_id,
    template_id,
    version_number,
    vehicle_id,
    filled_by,
    status,
    device_info
  )
  VALUES (
    caller_client_id,
    p_template_id,
    template_version_number,
    resolved_trailer_id,
    auth.uid(),
    'in_progress',
    p_device_info
  )
  RETURNING id
  INTO resolved_checklist_id;

  RETURN QUERY
  SELECT
    resolved_checklist_id,
    resolved_trailer_id,
    resolved_tractor_id,
    resolved_third_party_tractor_id,
    resolved_third_party_driver_id,
    resolved_open_coupling_id,
    resolved_open_coupling_odometer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_coupling_checklist(uuid, text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
