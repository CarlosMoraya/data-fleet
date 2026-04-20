import { Tire, TirePositionHistory, TirePositionType, TireVisualClassification, VehicleTireConfig } from '../types';

// ─── TireRow ─────────────────────────────────────────────────────────────────

export interface TireRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  tire_code: string;
  specification: string;
  dot: string | null;
  fire_marking: string | null;
  manufacturer: string | null;
  brand: string | null;
  rotation_interval_km: number | null;
  useful_life_km: number | null;
  retread_interval_km: number | null;
  visual_classification: string;
  current_position: string;
  last_position: string | null;
  position_type: string;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // joins
  vehicles?: { license_plate: string; model: string; type: string } | null;
}

// ─── TirePositionHistoryRow ───────────────────────────────────────────────────

export interface TirePositionHistoryRow {
  id: string;
  client_id: string;
  tire_id: string;
  vehicle_id: string;
  previous_position: string | null;
  new_position: string;
  moved_at: string;
  moved_by: string;
  reason: string | null;
  odometer_km: number | null;
  // join
  profiles?: { name: string } | null;
}

// ─── VehicleTireConfigRow ────────────────────────────────────────────────────

export interface VehicleTireConfigRow {
  id: string;
  vehicle_type: string;
  default_axles: number;
  default_spare_count: number;
  dual_axles: number[];
}

// ─── Converters ──────────────────────────────────────────────────────────────

export function tireFromRow(row: TireRow): Tire {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    tireCode: row.tire_code,
    specification: row.specification,
    dot: row.dot ?? undefined,
    fireMarking: row.fire_marking ?? undefined,
    manufacturer: row.manufacturer ?? undefined,
    brand: row.brand ?? undefined,
    rotationIntervalKm: row.rotation_interval_km ?? undefined,
    usefulLifeKm: row.useful_life_km ?? undefined,
    retreadIntervalKm: row.retread_interval_km ?? undefined,
    visualClassification: row.visual_classification as TireVisualClassification,
    currentPosition: row.current_position,
    lastPosition: row.last_position ?? undefined,
    positionType: row.position_type as TirePositionType,
    active: row.active,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicleLicensePlate: row.vehicles?.license_plate ?? undefined,
    vehicleModel: row.vehicles?.model ?? undefined,
    vehicleType: row.vehicles?.type ?? undefined,
  };
}

export function tireHistoryFromRow(row: TirePositionHistoryRow): TirePositionHistory {
  return {
    id: row.id,
    clientId: row.client_id,
    tireId: row.tire_id,
    vehicleId: row.vehicle_id,
    previousPosition: row.previous_position ?? undefined,
    newPosition: row.new_position,
    movedAt: row.moved_at,
    movedBy: row.moved_by,
    movedByName: row.profiles?.name ?? undefined,
    reason: row.reason ?? undefined,
    odometerKm: row.odometer_km ?? undefined,
  };
}

export function vehicleTireConfigFromRow(row: VehicleTireConfigRow): VehicleTireConfig {
  return {
    id: row.id,
    vehicleType: row.vehicle_type,
    defaultAxles: row.default_axles,
    defaultSpareCount: row.default_spare_count,
    dualAxles: Array.isArray(row.dual_axles) ? row.dual_axles : [],
  };
}
