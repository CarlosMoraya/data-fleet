import { supabase } from '../lib/supabase';
import { calculateTotalTires } from '../lib/axleConfigUtils';
import { generatePositionsFromConfig } from '../lib/tirePositions';
import {
  tireInspectionFromRow,
  tireInspectionResponseFromRow,
  tireInspectionResponseToRow,
  type TireInspectionRow,
  type TireInspectionResponseRow,
} from '../lib/tireInspectionMappers';
import type { TireInspection, TireInspectionResponse } from '../types';
import type { AxleConfigEntry } from '../types/tire';

const PHOTO_BUCKET = 'checklist-photos';
const OTHER_OPTION = 'Outros / Não é possível identificar';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTireInspection(inspectionId: string): Promise<TireInspection> {
  const { data, error } = await supabase
    .from('tire_inspections')
    .select('*, vehicles(license_plate), profiles(name)')
    .eq('id', inspectionId)
    .single();
  if (error) throw error;
  return tireInspectionFromRow(data as TireInspectionRow);
}

export async function fetchTireInspections(clientId: string): Promise<TireInspection[]> {
  const { data, error } = await supabase
    .from('tire_inspections')
    .select('*, vehicles(license_plate), profiles(name)')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data as TireInspectionRow[]).map(tireInspectionFromRow);
}

export async function fetchTireInspectionResponses(inspectionId: string): Promise<TireInspectionResponse[]> {
  const { data, error } = await supabase
    .from('tire_inspection_responses')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('responded_at', { ascending: true });
  if (error) throw error;
  return (data as TireInspectionResponseRow[]).map(tireInspectionResponseFromRow);
}

// ─── Distinct manufacturers / brands ─────────────────────────────────────────

export async function fetchDistinctManufacturers(vehicleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tires')
    .select('manufacturer')
    .eq('vehicle_id', vehicleId)
    .eq('active', true)
    .not('manufacturer', 'is', null);
  if (error) throw error;
  const distinct = [...new Set((data ?? []).map((r: { manufacturer: string }) => r.manufacturer).filter(Boolean))];
  return [...distinct, OTHER_OPTION];
}

export async function fetchDistinctBrands(vehicleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tires')
    .select('brand')
    .eq('vehicle_id', vehicleId)
    .eq('active', true)
    .not('brand', 'is', null);
  if (error) throw error;
  const distinct = [...new Set((data ?? []).map((r: { brand: string }) => r.brand).filter(Boolean))];
  return [...distinct, OTHER_OPTION];
}

// ─── Validation ───────────────────────────────────────────────────────────────

export async function validateTireInspectionEligibility(
  vehicleId: string,
  axleConfig: AxleConfigEntry[],
  stepsCount: number,
  vehicleType: string,
  pneusDayInterval: number,
): Promise<void> {
  await validateTiresRegistered(vehicleId, axleConfig, stepsCount, vehicleType);
  await validateInspectionInterval(vehicleId, pneusDayInterval);
}

async function validateTiresRegistered(
  vehicleId: string,
  axleConfig: AxleConfigEntry[],
  stepsCount: number,
  vehicleType: string,
): Promise<void> {
  const expected = calculateTotalTires(axleConfig, stepsCount);
  const positions = generatePositionsFromConfig(axleConfig, stepsCount, vehicleType);

  const { data, error } = await supabase
    .from('tires')
    .select('current_position')
    .eq('vehicle_id', vehicleId)
    .eq('active', true);
  if (error) throw error;

  const registeredPositions = new Set((data ?? []).map((r: { current_position: string }) => r.current_position));
  const allCovered = positions.every(p => registeredPositions.has(p.code));

  if (!allCovered || (data ?? []).length < expected) {
    throw new Error('É necessário cadastrar todos os pneus desse veículo antes de iniciar a inspeção.');
  }
}

async function validateInspectionInterval(vehicleId: string, intervalDays: number): Promise<void> {
  const { data } = await supabase
    .from('tire_inspections')
    .select('completed_at')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (!data?.completed_at) return;

  const lastDate = new Date(data.completed_at);
  const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < intervalDays) {
    const nextDate = new Date(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const formatted = nextDate.toLocaleDateString('pt-BR');
    throw new Error(`Próxima inspeção disponível a partir de ${formatted}.`);
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateInspectionPayload {
  clientId: string;
  vehicleId: string;
  filledBy: string;
  axleConfig: AxleConfigEntry[];
  stepsCount: number;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
}

export async function createTireInspection(payload: CreateInspectionPayload): Promise<string> {
  const { clientId, vehicleId, filledBy, axleConfig, stepsCount, latitude, longitude, deviceInfo } = payload;

  const { data, error } = await supabase
    .from('tire_inspections')
    .insert({
      client_id: clientId,
      vehicle_id: vehicleId,
      filled_by: filledBy,
      axle_config_snapshot: axleConfig,
      steps_count_snapshot: stepsCount,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      device_info: deviceInfo ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ─── Save response ────────────────────────────────────────────────────────────

export interface SaveInspectionResponsePayload {
  inspectionId: string;
  clientId: string;
  response: Omit<TireInspectionResponse, 'id'>;
  photoBlob?: Blob;
  photoFilename?: string;
}

export async function saveInspectionResponse(payload: SaveInspectionResponsePayload): Promise<TireInspectionResponse> {
  const { inspectionId, clientId, response, photoBlob, photoFilename } = payload;

  let photoUrl = response.photoUrl;

  if (photoBlob && photoFilename) {
    photoUrl = await uploadInspectionPhoto(clientId, inspectionId, response.positionCode, photoBlob, photoFilename);
  }

  const row = tireInspectionResponseToRow({ ...response, photoUrl });

  const { data, error } = await supabase
    .from('tire_inspection_responses')
    .upsert({ ...row, inspection_id: inspectionId }, { onConflict: 'inspection_id,position_code' })
    .select()
    .single();

  if (error) throw error;
  return tireInspectionResponseFromRow(data as TireInspectionResponseRow);
}

async function uploadInspectionPhoto(
  clientId: string,
  inspectionId: string,
  positionCode: string,
  blob: Blob,
  filename: string,
): Promise<string> {
  const safeCode = positionCode.replace(/\s+/g, '_');
  const timestamp = Date.now();
  const path = `${clientId}/tire-inspections/${inspectionId}/${safeCode}/${timestamp}_${filename}`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export async function completeTireInspection(
  inspectionId: string,
  odometerKm: number,
): Promise<void> {
  await validateAllPositionsAnswered(inspectionId);

  const { error } = await supabase
    .from('tire_inspections')
    .update({ status: 'completed', completed_at: new Date().toISOString(), odometer_km: odometerKm })
    .eq('id', inspectionId);

  if (error) throw error;
}

async function validateAllPositionsAnswered(inspectionId: string): Promise<void> {
  const inspection = await fetchTireInspection(inspectionId);
  const positions = generatePositionsFromConfig(
    inspection.axleConfigSnapshot,
    inspection.stepsCountSnapshot,
    '',
  );

  const { data, error } = await supabase
    .from('tire_inspection_responses')
    .select('position_code')
    .eq('inspection_id', inspectionId);
  if (error) throw error;

  const answered = new Set((data ?? []).map((r: { position_code: string }) => r.position_code));
  const unanswered = positions.filter(p => !answered.has(p.code));

  if (unanswered.length > 0) {
    throw new Error(`${unanswered.length} pneu(s) ainda sem resposta: ${unanswered.map(p => p.code).join(', ')}`);
  }
}
