CREATE OR REPLACE FUNCTION public.insert_coupling_backoffice(
  p_client_id uuid,
  p_trailer_id uuid,
  p_tractor_id uuid DEFAULT NULL,
  p_tractor_plate text DEFAULT NULL,
  p_tractor_driver_name text DEFAULT NULL,
  p_third_party_tractor_id uuid DEFAULT NULL,
  p_third_party_driver_id uuid DEFAULT NULL,
  p_coupled_at timestamptz DEFAULT now(),
  p_uncoupled_at timestamptz DEFAULT NULL,
  p_coupled_latitude numeric DEFAULT NULL,
  p_coupled_longitude numeric DEFAULT NULL,
  p_uncoupled_latitude numeric DEFAULT NULL,
  p_uncoupled_longitude numeric DEFAULT NULL,
  p_odometer_coupled numeric DEFAULT NULL,
  p_odometer_uncoupled numeric DEFAULT NULL,
  p_distance_km numeric DEFAULT NULL,
  p_coupling_checklist_id uuid DEFAULT NULL,
  p_uncoupling_checklist_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  caller_client_id uuid;
  inserted_id uuid;
BEGIN
  SELECT role, client_id
  INTO caller_role, caller_client_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF caller_role <> 'Admin Master'
     AND (
       public.role_rank(caller_role) < 3
       OR caller_client_id IS DISTINCT FROM p_client_id
     ) THEN
    RAISE EXCEPTION 'insufficient_privileges';
  END IF;

  INSERT INTO public.vehicle_couplings (
    client_id,
    trailer_id,
    tractor_id,
    tractor_plate,
    tractor_driver_name,
    third_party_tractor_id,
    third_party_driver_id,
    coupled_at,
    uncoupled_at,
    coupled_latitude,
    coupled_longitude,
    uncoupled_latitude,
    uncoupled_longitude,
    odometer_coupled,
    odometer_uncoupled,
    distance_km,
    coupling_checklist_id,
    uncoupling_checklist_id,
    filled_by,
    notes
  )
  VALUES (
    p_client_id,
    p_trailer_id,
    p_tractor_id,
    p_tractor_plate,
    p_tractor_driver_name,
    p_third_party_tractor_id,
    p_third_party_driver_id,
    p_coupled_at,
    p_uncoupled_at,
    p_coupled_latitude,
    p_coupled_longitude,
    p_uncoupled_latitude,
    p_uncoupled_longitude,
    p_odometer_coupled,
    p_odometer_uncoupled,
    p_distance_km,
    p_coupling_checklist_id,
    p_uncoupling_checklist_id,
    auth.uid(),
    p_notes
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_coupling_backoffice(
  uuid, uuid, uuid, text, text, uuid, uuid, timestamptz, timestamptz, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, uuid, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
