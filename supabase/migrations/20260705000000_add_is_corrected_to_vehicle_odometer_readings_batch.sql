-- ── Adiciona is_corrected à RPC em lote de KM efetivo (evolução aditiva) ──
--
-- O último KM oficial por veículo passa a vir da view
-- public.vehicle_odometer_effective_readings (fonte única já usada pelo
-- histórico detalhado), em vez de agregação manual sobre `checklists`.
--
-- A view só cobre veículos com pelo menos um checklist concluído. Para
-- preservar o fallback existente (vehicles.initial_km, usado por Revisões
-- de Garantia quando o veículo ainda não tem checklist), o COALESCE com
-- initial_km é mantido; nesse caso is_corrected é sempre false, pois não há
-- leitura corrigível.
--
-- vehicle_id e effective_km continuam com mesmo nome/posição/tipo — nenhum
-- consumidor existente quebra.
--
-- O Postgres não permite CREATE OR REPLACE quando a lista de colunas OUT
-- muda (assinatura de parâmetros de entrada é a mesma, mas o retorno ganhou
-- is_corrected), por isso a função precisa ser removida antes de recriada.

DROP FUNCTION IF EXISTS get_vehicle_odometer_readings_batch(UUID[]);

CREATE OR REPLACE FUNCTION get_vehicle_odometer_readings_batch(p_vehicle_ids UUID[])
RETURNS TABLE(
  vehicle_id UUID,
  effective_km NUMERIC,
  is_corrected BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      v.id AS vehicle_id,
      COALESCE(r.effective_km, v.initial_km::numeric) AS effective_km,
      COALESCE(r.is_corrected, false) AS is_corrected
    FROM vehicles v
    LEFT JOIN LATERAL (
      SELECT o.effective_km, o.is_corrected
      FROM public.vehicle_odometer_effective_readings o
      WHERE o.vehicle_id = v.id
      ORDER BY o.effective_km DESC, o.reading_at DESC
      LIMIT 1
    ) r ON true
    WHERE v.id = ANY(p_vehicle_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_vehicle_odometer_readings_batch(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
