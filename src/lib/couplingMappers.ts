import type { VehicleCoupling } from '../types/coupling';

export interface VehicleCouplingRow {
  id: string;
  client_id: string;
  trailer_id: string;
  tractor_id: string | null;
  tractor_plate: string | null;
  tractor_driver_name: string | null;
  third_party_tractor_id: string | null;
  third_party_driver_id: string | null;
  coupled_at: string;
  uncoupled_at: string | null;
  coupled_latitude: number | string | null;
  coupled_longitude: number | string | null;
  uncoupled_latitude: number | string | null;
  uncoupled_longitude: number | string | null;
  odometer_coupled: number | string | null;
  odometer_uncoupled: number | string | null;
  distance_km: number | string | null;
  coupling_checklist_id: string | null;
  uncoupling_checklist_id: string | null;
  filled_by: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function asNumber(value: number | string | null | undefined): number | null | undefined {
  if (value == null) return value as null | undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function couplingFromRow(row: VehicleCouplingRow): VehicleCoupling {
  return {
    id: row.id,
    clientId: row.client_id,
    trailerId: row.trailer_id,
    tractorId: row.tractor_id,
    tractorPlate: row.tractor_plate ?? undefined,
    tractorDriverName: row.tractor_driver_name ?? undefined,
    thirdPartyTractorId: row.third_party_tractor_id,
    thirdPartyDriverId: row.third_party_driver_id,
    coupledAt: row.coupled_at,
    uncoupledAt: row.uncoupled_at,
    coupledLatitude: asNumber(row.coupled_latitude),
    coupledLongitude: asNumber(row.coupled_longitude),
    uncoupledLatitude: asNumber(row.uncoupled_latitude),
    uncoupledLongitude: asNumber(row.uncoupled_longitude),
    odometerCoupled: asNumber(row.odometer_coupled),
    odometerUncoupled: asNumber(row.odometer_uncoupled),
    distanceKm: asNumber(row.distance_km),
    couplingChecklistId: row.coupling_checklist_id,
    uncouplingChecklistId: row.uncoupling_checklist_id,
    filledBy: row.filled_by,
    notes: row.notes,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}
