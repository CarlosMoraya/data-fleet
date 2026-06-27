import { mapOdometerReadingRow } from '../lib/odometerCorrectionMappers';
import { supabase } from '../lib/supabase';

import type { OdometerCorrectionInput, OdometerReading } from '../types/odometerCorrection';

interface ChecklistOdometerSource {
  client_id: string;
  vehicle_id: string;
  odometer_km: number;
}

export async function listVehicleOdometerHistory(vehicleId: string): Promise<OdometerReading[]> {
  const rpcResult = await supabase.rpc('get_vehicle_odometer_readings', {
    p_vehicle_id: vehicleId,
  });

  if (rpcResult.error) throw rpcResult.error;
  const rows = (rpcResult.data as Record<string, unknown>[] | null) ?? [];
  return rows.map((row) => mapOdometerReadingRow(row));
}

export async function createOdometerCorrection(
  input: OdometerCorrectionInput & { correctedBy: string },
): Promise<void> {
  const checklistResult = await supabase
    .from('checklists')
    .select('client_id, vehicle_id, odometer_km')
    .eq('id', input.checklistId)
    .single();

  if (checklistResult.error) throw checklistResult.error;

  const source = checklistResult.data as ChecklistOdometerSource;
  const { error } = await supabase.from('vehicle_odometer_corrections').insert({
    client_id: source.client_id,
    vehicle_id: source.vehicle_id,
    checklist_id: input.checklistId,
    original_km: source.odometer_km,
    corrected_km: input.correctedKm,
    reason: input.reason,
    corrected_by: input.correctedBy,
  });

  if (error) throw error;
}
