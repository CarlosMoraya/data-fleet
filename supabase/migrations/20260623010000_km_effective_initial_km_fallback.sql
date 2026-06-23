-- ── Km Inicial como base mais fraca da precedência de KM efetivo ──
-- Quando o veículo ainda não tem nenhum checklist concluído com odômetro,
-- o KM atual passa a ser vehicles.initial_km (Km Inicial do cadastro).
-- Precedência: leitura efetiva de checklist (com correção) > vehicles.initial_km.
-- CREATE OR REPLACE preserva nome/assinatura/contrato — nenhum consumidor muda.

-- 1) Variante singular (consumida por ChecklistFill e MaintenanceForm)
CREATE OR REPLACE FUNCTION get_vehicle_max_effective_km(p_vehicle_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT MAX(COALESCE(corr.corrected_km, c.odometer_km::numeric))
      FROM checklists c
      LEFT JOIN LATERAL (
        SELECT oc.corrected_km
        FROM vehicle_odometer_corrections oc
        WHERE oc.checklist_id = c.id
        ORDER BY oc.corrected_at DESC
        LIMIT 1
      ) corr ON true
      WHERE c.vehicle_id = p_vehicle_id
        AND c.status = 'completed'
        AND c.odometer_km IS NOT NULL
    ),
    (SELECT v.initial_km::numeric FROM vehicles v WHERE v.id = p_vehicle_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_vehicle_max_effective_km(UUID) TO authenticated;

-- 2) Variante em lote (consumida por Revisões de Garantia)
--    Agora retorna UMA linha por veículo solicitado (FROM vehicles), com
--    effective_km = COALESCE(MAX de checklists, vehicles.initial_km).
CREATE OR REPLACE FUNCTION get_vehicle_odometer_readings_batch(p_vehicle_ids UUID[])
RETURNS TABLE(
  vehicle_id UUID,
  effective_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      v.id AS vehicle_id,
      COALESCE(
        (
          SELECT MAX(COALESCE(corr.corrected_km, c.odometer_km::numeric))
          FROM checklists c
          LEFT JOIN LATERAL (
            SELECT oc.corrected_km
            FROM vehicle_odometer_corrections oc
            WHERE oc.checklist_id = c.id
            ORDER BY oc.corrected_at DESC
            LIMIT 1
          ) corr ON true
          WHERE c.vehicle_id = v.id
            AND c.status = 'completed'
            AND c.odometer_km IS NOT NULL
        ),
        v.initial_km::numeric
      ) AS effective_km
    FROM vehicles v
    WHERE v.id = ANY(p_vehicle_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_vehicle_odometer_readings_batch(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';