-- FASE 3 (Etapa 3.2): cálculo do km da carreta conforme trailer_km_mode do cliente
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV primeiro)
-- Acúmulo sempre por delta durante cada engate — NUNCA odômetro absoluto do último cavalo.

CREATE OR REPLACE FUNCTION public.trailer_effective_km(p_trailer_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_mode text;
  v_result numeric;
BEGIN
  SELECT client_id INTO v_client_id FROM public.vehicles WHERE id = p_trailer_id;

  SELECT trailer_km_mode INTO v_mode
  FROM public.vehicle_km_source_settings
  WHERE client_id = v_client_id;

  IF v_mode IS NULL THEN
    v_mode := 'coupling_accumulated';
  END IF;

  IF v_mode = 'hubodometer' THEN
    -- MAX−MIN sobre as leituras de origem hubodômetro do próprio implemento.
    SELECT MAX(r.effective_km) - MIN(r.effective_km)
    INTO v_result
    FROM public.vehicle_odometer_effective_readings r
    WHERE r.vehicle_id = p_trailer_id
      AND r.origin = 'hubodometer';
  ELSE
    -- Soma do distance_km (delta por janela de engate) de todos os engates fechados.
    SELECT SUM(vc.distance_km)
    INTO v_result
    FROM public.vehicle_couplings vc
    WHERE vc.trailer_id = p_trailer_id
      AND vc.uncoupled_at IS NOT NULL;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trailer_effective_km(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- DROP FUNCTION IF EXISTS public.trailer_effective_km(uuid);
-- NOTIFY pgrst, 'reload schema';
