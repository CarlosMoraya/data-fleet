-- Função para retornar o KM efetivo máximo de um veículo,
-- bypassando RLS para que motoristas possam validar hodômetro
-- contra o último registro de qualquer usuário do mesmo tenant.
CREATE OR REPLACE FUNCTION get_vehicle_max_effective_km(p_vehicle_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
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
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que a função seja acessível a usuários autenticados
GRANT EXECUTE ON FUNCTION get_vehicle_max_effective_km(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';