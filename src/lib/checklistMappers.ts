import type { Checklist, ChecklistResponse, ChecklistStatus, ResponseStatus, ChecklistContext, ChecklistLocationStatus } from '../types';
import type { VehicleLinkDivergenceReason } from './vehicleLinkDivergence';

// ─── Row types (snake_case from Supabase) ─────────────────────────────────────

export interface ChecklistRow {
  id: string;
  client_id: string;
  template_id: string;
  version_number: number;
  vehicle_id: string | null;
  filled_by: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  location_status: string | null;
  device_info: string | null;
  notes: string | null;
  workshop_id: string | null;
  odometer_km: number | null;
  odometer_photo_url: string | null;
  driver_id: string | null;
  cnh_photo_url: string | null;
  signature_url: string | null;
  vehicle_link_divergence_reasons: VehicleLinkDivergenceReason[] | null;
  vehicle_link_assigned_driver_id: string | null;
  vehicle_link_executor_vehicle_id: string | null;
  // join fields
  checklist_templates?: { name: string; context: string } | null;
  vehicles?: { license_plate: string; driver?: { name: string } | null } | null;
  profiles?: { name: string } | null;
  workshops?: { name: string } | null;
  drivers?: { name: string } | null;
  assigned_driver?: { name: string } | null;
  executor_vehicle?: { license_plate: string } | null;
}

export interface ChecklistResponseRow {
  id: string;
  checklist_id: string;
  item_id: string;
  status: string;
  observation: string | null;
  photo_url: string | null;
  responded_at: string;
  // join
  checklist_items?: { title: string } | null;
}

// ─── fromRow converters ───────────────────────────────────────────────────────

export function checklistFromRow(row: ChecklistRow): Checklist {
  return {
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id,
    templateName: row.checklist_templates?.name ?? undefined,
    templateContext: row.checklist_templates?.context as ChecklistContext | undefined ?? undefined,
    versionNumber: row.version_number,
    vehicleId: row.vehicle_id ?? undefined,
    vehicleLicensePlate: row.vehicles?.license_plate ?? undefined,
    vehicleDriverName: row.vehicles?.driver?.name ?? undefined,
    filledBy: row.filled_by,
    filledByName: row.profiles?.name ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    status: row.status as ChecklistStatus,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    locationStatus: (row.location_status as ChecklistLocationStatus | null) ?? undefined,
    deviceInfo: row.device_info ?? undefined,
    notes: row.notes ?? undefined,
    workshopId: row.workshop_id ?? undefined,
    workshopName: row.workshops?.name ?? undefined,
    odometerKm: row.odometer_km ?? undefined,
    odometerPhotoUrl: row.odometer_photo_url ?? undefined,
    driverId: row.driver_id ?? undefined,
    driverName: row.drivers?.name ?? undefined,
    cnhPhotoUrl: row.cnh_photo_url ?? undefined,
    signatureUrl: row.signature_url ?? undefined,
    vehicleLinkDivergenceReasons: row.vehicle_link_divergence_reasons ?? undefined,
    vehicleLinkAssignedDriverId: row.vehicle_link_assigned_driver_id ?? undefined,
    vehicleLinkAssignedDriverName: row.assigned_driver?.name ?? undefined,
    vehicleLinkExecutorVehicleId: row.vehicle_link_executor_vehicle_id ?? undefined,
    vehicleLinkExecutorVehiclePlate: row.executor_vehicle?.license_plate ?? undefined,
  };
}

export function checklistResponseFromRow(row: ChecklistResponseRow): ChecklistResponse {
  return {
    id: row.id,
    checklistId: row.checklist_id,
    itemId: row.item_id,
    itemTitle: row.checklist_items?.title ?? undefined,
    status: row.status as ResponseStatus,
    observation: row.observation ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    respondedAt: row.responded_at,
  };
}
