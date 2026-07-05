import { supabase } from '../lib/supabase';

/** Mapa de KM efetivo máximo (`MAX(effective_km)`) por veículo, buscado em lote. */
export async function getVehicleLastKmMap(vehicleIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniqueIds = Array.from(new Set(vehicleIds));
  if (uniqueIds.length === 0) return map;

  const rpcResult = await supabase.rpc('get_vehicle_odometer_readings_batch', {
    p_vehicle_ids: uniqueIds,
  });
  if (rpcResult.error) throw rpcResult.error;

  type KmRow = { vehicle_id: string; effective_km: number };
  for (const row of (rpcResult.data as KmRow[] | null) ?? []) {
    const current = map.get(row.vehicle_id);
    if (current == null || row.effective_km > current) {
      map.set(row.vehicle_id, row.effective_km);
    }
  }
  return map;
}

/** Formata o último KM oficial de um veículo para exibição discreta sob a placa. */
export function formatLastKmLabel(km: number | null | undefined): string {
  if (km == null) return 'Último Km: sem leitura';
  return `Último Km: ${km.toLocaleString('pt-BR')} km`;
}
