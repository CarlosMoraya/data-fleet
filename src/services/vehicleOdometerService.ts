import { supabase } from '../lib/supabase';

export interface VehicleLastKmInfo {
  value: number;
  isCorrected: boolean;
}

export interface LastKmDisplayParts {
  prefix: string;
  valueText: string | null;
  suffix: string | null;
  fullText: string;
}

/** Mapa do último KM oficial (com metadado de correção) por veículo, buscado em lote. */
export async function getVehicleLastKmMap(
  vehicleIds: string[]
): Promise<Map<string, VehicleLastKmInfo>> {
  const map = new Map<string, VehicleLastKmInfo>();
  const uniqueIds = Array.from(new Set(vehicleIds));
  if (uniqueIds.length === 0) return map;

  const rpcResult = await supabase.rpc('get_vehicle_odometer_readings_batch', {
    p_vehicle_ids: uniqueIds,
  });
  if (rpcResult.error) throw rpcResult.error;

  type KmRow = { vehicle_id: string; effective_km: number | null; is_corrected: boolean };
  for (const row of (rpcResult.data as KmRow[] | null) ?? []) {
    if (row.effective_km == null) continue;
    const current = map.get(row.vehicle_id);
    if (current == null || row.effective_km > current.value) {
      map.set(row.vehicle_id, { value: row.effective_km, isCorrected: row.is_corrected });
    }
  }
  return map;
}

/** Monta as partes textuais do rótulo de `Último Km` para apresentação padronizada. */
export function buildLastKmDisplayParts(
  info: VehicleLastKmInfo | null | undefined
): LastKmDisplayParts {
  const prefix = 'Último Km:';

  if (info == null) {
    return { prefix, valueText: null, suffix: null, fullText: 'Último Km: sem leitura' };
  }

  const valueText = `${info.value.toLocaleString('pt-BR')} km`;
  const suffix = info.isCorrected ? '(Editado)' : null;
  const fullText = suffix ? `${prefix} ${valueText} ${suffix}` : `${prefix} ${valueText}`;

  return { prefix, valueText, suffix, fullText };
}
