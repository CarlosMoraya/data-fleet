import { calculateTotalTires } from '../lib/axleConfigUtils';
import { supabase } from '../lib/supabase';
import {
  tireInspectionFromRow,
  tireInspectionResponseFromRow,
  tireInspectionResponseToRow,
  type TireInspectionRow,
  type TireInspectionResponseRow,
} from '../lib/tireInspectionMappers';
import { generatePositionsFromConfig } from '../lib/tirePositions';

import type { TireInspection, TireInspectionResponse, TireInspectionResponseStatus } from '../types';
import type { AxleConfigEntry } from '../types/tire';

const PHOTO_BUCKET = 'checklist-photos';
const OTHER_OPTION = 'Outros / Não é possível identificar';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTireInspection(inspectionId: string): Promise<TireInspection> {
  const result = await supabase
    .from('tire_inspections')
    .select('*, vehicles!vehicle_id(license_plate), profiles(name), assigned_driver:drivers!vehicle_link_assigned_driver_id(name), executor_vehicle:vehicles!vehicle_link_executor_vehicle_id(license_plate)')
    .eq('id', inspectionId)
    .single();
  if (result.error) throw result.error;
  return tireInspectionFromRow(result.data as TireInspectionRow);
}

export async function fetchTireInspections(clientId: string): Promise<TireInspection[]> {
  const { data, error } = await supabase
    .from('tire_inspections')
    .select('*, vehicles!vehicle_id(license_plate), profiles(name), assigned_driver:drivers!vehicle_link_assigned_driver_id(name), executor_vehicle:vehicles!vehicle_link_executor_vehicle_id(license_plate)')
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

// ─── Open inspection lookup ─────────────────────────────────────────────────

/**
 * Returns the id of an existing in-progress tire inspection for the given
 * vehicle within the current tenant (RLS-scoped), or null if none exists.
 * Used to resume an open inspection instead of creating a duplicate.
 */
export async function findOpenTireInspection(vehicleId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tire_inspections')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

export interface PositionComparison {
  positionCode: string;
  positionLabel: string;
  photos: Array<{
    inspectionId: string;
    inspectionDate: string;
    photoUrl: string;
    photoTimestamp: string;
    status: TireInspectionResponseStatus;
    isCurrent: boolean;
  }>;
}

export async function fetchTireInspectionComparison(
  vehicleId: string,
  currentInspection: TireInspection,
): Promise<PositionComparison[]> {
  const effectiveDate = (inspection: { started_at: string; completed_at: string | null }) =>
    inspection.completed_at ?? inspection.started_at;

  const inspResult = await supabase
    .from('tire_inspections')
    .select('id, started_at, completed_at')
    .eq('vehicle_id', vehicleId);
  if (inspResult.error) throw inspResult.error;

  type InspRow = { id: string; started_at: string; completed_at: string | null };
  const inspections = (inspResult.data as InspRow[] | null) ?? [];
  const sorted = inspections
    .slice()
    .sort((a, b) => effectiveDate(b).localeCompare(effectiveDate(a)));
  const idx = sorted.findIndex((inspection) => inspection.id === currentInspection.id);
  const windowInspections = idx >= 0 ? sorted.slice(idx, idx + 3) : sorted.slice(0, 3);
  const inspectionIds = windowInspections.map((inspection) => inspection.id);
  if (inspectionIds.length === 0) return [];

  const inspectionDates = new Map(
    windowInspections.map((inspection) => [inspection.id, inspection.started_at]),
  );
  const effectiveDates = new Map(
    windowInspections.map((inspection) => [inspection.id, effectiveDate(inspection)]),
  );

  const { data: responses, error: responsesError } = await supabase
    .from('tire_inspection_responses')
    .select('*')
    .in('inspection_id', inspectionIds);
  if (responsesError) throw responsesError;

  const mappedResponses = (responses as TireInspectionResponseRow[]).map(tireInspectionResponseFromRow);
  const positions = generatePositionsFromConfig(
    currentInspection.axleConfigSnapshot,
    currentInspection.stepsCountSnapshot,
    '',
  );

  return positions
    .map((position) => ({
      positionCode: position.code,
      positionLabel: position.label,
      photos: mappedResponses
        .filter((response) => response.positionCode === position.code)
        .sort((a, b) => {
          const da = effectiveDates.get(a.inspectionId) ?? '';
          const db = effectiveDates.get(b.inspectionId) ?? '';
          return db.localeCompare(da);
        })
        .slice(0, 3)
        .map((response) => ({
          inspectionId: response.inspectionId,
          inspectionDate: inspectionDates.get(response.inspectionId) ?? '',
          photoUrl: response.photoUrl,
          photoTimestamp: response.photoTimestamp,
          status: response.status,
          isCurrent: response.inspectionId === currentInspection.id,
        })),
    }))
    .filter((comparison) => comparison.photos.length > 0);
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

  const inspData = data as { completed_at: string | null } | null;
  if (!inspData?.completed_at) return;

  const lastDate = new Date(inspData.completed_at);
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
  return (data as { id: string }).id;
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

  const upsertResult = await supabase
    .from('tire_inspection_responses')
    .upsert({ ...row, inspection_id: inspectionId }, { onConflict: 'inspection_id,position_code' })
    .select()
    .single();

  if (upsertResult.error) throw upsertResult.error;
  return tireInspectionResponseFromRow(upsertResult.data as TireInspectionResponseRow);
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
