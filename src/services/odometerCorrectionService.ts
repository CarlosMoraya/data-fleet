import { supabase } from '../lib/supabase';
import { mapOdometerReadingRow } from '../lib/odometerCorrectionMappers';
import type { OdometerCorrectionInput, OdometerReading } from '../types/odometerCorrection';

interface ChecklistOdometerSource {
  client_id: string;
  vehicle_id: string;
  odometer_km: number;
}

export async function listVehicleOdometerHistory(vehicleId: string): Promise<OdometerReading[]> {
  const { data, error } = await supabase.rpc('get_vehicle_odometer_readings', {
    p_vehicle_id: vehicleId,
  });

  if (error) throw error;
  return (data ?? []).map((row) => mapOdometerReadingRow(row as Record<string, unknown>));
}

export async function createOdometerCorrection(
  input: OdometerCorrectionInput & { correctedBy: string },
): Promise<void> {
  const { data: checklist, error: checklistError } = await supabase
    .from('checklists')
    .select('client_id, vehicle_id, odometer_km')
    .eq('id', input.checklistId)
    .single();

  if (checklistError) throw checklistError;

  const source = checklist as ChecklistOdometerSource;
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
