-- ── Fonte única de KM efetivo — SECURITY DEFINER para independência de RLS ──
--
-- A view `vehicle_odometer_effective_readings` herda RLS da tabela
-- `checklists`. Isso faz com que motoristas (que só veem seus próprios
-- checklists) não consigam obter o KM real do veículo quando outro
-- motorista/gestor preencheu o último checklist.
--
-- Esta função `SECURITY DEFINER` bypassa RLS e retorna o mesmo conjunto
-- de dados, tornando-se a nova fonte única confiável.

CREATE OR REPLACE FUNCTION get_vehicle_odometer_readings(p_vehicle_id UUID)
RETURNS TABLE(
  checklist_id UUID,
  vehicle_id UUID,
  client_id UUID,
  reading_at TIMESTAMPTZ,
  original_km NUMERIC,
  effective_km NUMERIC,
  is_corrected BOOLEAN,
  correction_reason TEXT,
  corrected_by UUID,
  corrected_at TIMESTAMPTZ,
  source_context TEXT,
  has_evidence BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id AS checklist_id,
      c.vehicle_id,
      c.client_id,
      c.completed_at AS reading_at,
      c.odometer_km::numeric AS original_km,
      COALESCE(corr.corrected_km, c.odometer_km::numeric) AS effective_km,
      corr.id IS NOT NULL AS is_corrected,
      corr.reason AS correction_reason,
      corr.corrected_by,
      corr.corrected_at,
      t.context AS source_context,
      c.odometer_photo_url IS NOT NULL AS has_evidence
    FROM checklists c
    LEFT JOIN checklist_templates t ON t.id = c.template_id
    LEFT JOIN LATERAL (
      SELECT oc.id, oc.corrected_km, oc.reason, oc.corrected_by, oc.corrected_at
      FROM vehicle_odometer_corrections oc
      WHERE oc.checklist_id = c.id
      ORDER BY oc.corrected_at DESC
      LIMIT 1
    ) corr ON true
    WHERE c.vehicle_id = p_vehicle_id
      AND c.status = 'completed'
      AND c.odometer_km IS NOT NULL
    ORDER BY c.completed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_vehicle_odometer_readings(UUID) TO authenticated;

-- Função auxiliar: apenas o KM máximo efetivo + data da última leitura
CREATE OR REPLACE FUNCTION get_vehicle_odometer_summary(p_vehicle_id UUID)
RETURNS TABLE(
  max_effective_km NUMERIC,
  last_reading_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      MAX(r.effective_km) AS max_effective_km,
      MAX(r.reading_at) FILTER (WHERE r.effective_km = (
        SELECT MAX(sub.effective_km) FROM get_vehicle_odometer_readings(p_vehicle_id) sub
      )) AS last_reading_at
    FROM get_vehicle_odometer_readings(p_vehicle_id) r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_vehicle_odometer_summary(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';