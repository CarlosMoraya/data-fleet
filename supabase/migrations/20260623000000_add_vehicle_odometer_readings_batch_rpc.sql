-- ── Fonte única de KM efetivo em LOTE — espelha get_vehicle_odometer_readings ──
--
-- O frontend (warrantyRevisionService.getMaxEffectiveKmForVehicles) precisa do
-- KM efetivo de vários veículos em uma única chamada. A função singular
-- get_vehicle_odometer_readings(UUID) já existe; esta é a variante em lote.
--
-- SECURITY DEFINER pelo mesmo motivo da singular: o KM vem de `checklists`,
-- protegida por RLS por motorista. Sem o bypass, gestores/analistas não
-- enxergam o KM real registrado por outro usuário.

CREATE OR REPLACE FUNCTION get_vehicle_odometer_readings_batch(p_vehicle_ids UUID[])
RETURNS TABLE(
  vehicle_id UUID,
  effective_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.vehicle_id,
      MAX(COALESCE(corr.corrected_km, c.odometer_km::numeric)) AS effective_km
    FROM checklists c
    LEFT JOIN LATERAL (
      SELECT oc.corrected_km
      FROM vehicle_odometer_corrections oc
      WHERE oc.checklist_id = c.id
      ORDER BY oc.corrected_at DESC
      LIMIT 1
    ) corr ON true
    WHERE c.vehicle_id = ANY(p_vehicle_ids)
      AND c.status = 'completed'
      AND c.odometer_km IS NOT NULL
    GROUP BY c.vehicle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_vehicle_odometer_readings_batch(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';