import type { TireInspection, TireInspectionResponse, TireInspectionStatus, TireInspectionResponseStatus } from '../types';
import type { AxleConfigEntry } from '../types/tire';

// ─── Row types (snake_case from Supabase) ─────────────────────────────────────

export interface TireInspectionRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  filled_by: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  odometer_km: number | null;
  latitude: number | null;
  longitude: number | null;
  device_info: string | null;
  notes: string | null;
  axle_config_snapshot: AxleConfigEntry[];
  steps_count_snapshot: number;
  // join fields
  vehicles?: { license_plate: string } | null;
  profiles?: { name: string } | null;
}

export interface TireInspectionResponseRow {
  id: string;
  inspection_id: string;
  tire_id: string | null;
  position_code: string;
  position_label: string;
  dot: string | null;
  fire_marking: string | null;
  manufacturer: string;
  brand: string;
  photo_url: string;
  photo_timestamp: string;
  status: string;
  observation: string | null;
  responded_at: string;
}

// ─── fromRow converters ───────────────────────────────────────────────────────

export function tireInspectionFromRow(row: TireInspectionRow): TireInspection {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    vehicleLicensePlate: row.vehicles?.license_plate ?? undefined,
    filledBy: row.filled_by,
    filledByName: row.profiles?.name ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    status: row.status as TireInspectionStatus,
    odometerKm: row.odometer_km ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    deviceInfo: row.device_info ?? undefined,
    notes: row.notes ?? undefined,
    axleConfigSnapshot: row.axle_config_snapshot,
    stepsCountSnapshot: row.steps_count_snapshot,
  };
}

export function tireInspectionResponseFromRow(row: TireInspectionResponseRow): TireInspectionResponse {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    tireId: row.tire_id ?? undefined,
    positionCode: row.position_code,
    positionLabel: row.position_label,
    dot: row.dot ?? undefined,
    fireMarking: row.fire_marking ?? undefined,
    manufacturer: row.manufacturer,
    brand: row.brand,
    photoUrl: row.photo_url,
    photoTimestamp: row.photo_timestamp,
    status: row.status as TireInspectionResponseStatus,
    observation: row.observation ?? undefined,
    respondedAt: row.responded_at,
  };
}

// ─── toRow converters ─────────────────────────────────────────────────────────

export function tireInspectionResponseToRow(
  r: Omit<TireInspectionResponse, 'id'>,
): Omit<TireInspectionResponseRow, 'id'> {
  return {
    inspection_id: r.inspectionId,
    tire_id: r.tireId ?? null,
    position_code: r.positionCode,
    position_label: r.positionLabel,
    dot: r.dot ?? null,
    fire_marking: r.fireMarking ?? null,
    manufacturer: r.manufacturer,
    brand: r.brand,
    photo_url: r.photoUrl,
    photo_timestamp: r.photoTimestamp,
    status: r.status,
    observation: r.observation ?? null,
    responded_at: r.respondedAt,
  };
}
