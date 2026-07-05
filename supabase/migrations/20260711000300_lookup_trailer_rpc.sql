CREATE OR REPLACE FUNCTION public.lookup_trailer_for_coupling(p_plate text)
RETURNS TABLE("exists" boolean, "available" boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_client_id uuid;
  matched_trailer_id uuid;
BEGIN
  SELECT client_id
  INTO caller_client_id
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT v.id
  INTO matched_trailer_id
  FROM public.vehicles v
  WHERE v.client_id = caller_client_id
    AND upper(v.license_plate) = upper(btrim(coalesce(p_plate, '')))
    AND v.type IN ('Semirreboque', 'Reboque', 'Dolly')
  LIMIT 1;

  IF matched_trailer_id IS NULL THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    NOT EXISTS (
      SELECT 1
      FROM public.vehicle_couplings c
      WHERE c.trailer_id = matched_trailer_id
        AND c.uncoupled_at IS NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_trailer_for_coupling(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
