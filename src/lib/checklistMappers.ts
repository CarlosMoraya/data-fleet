import type { Checklist, ChecklistResponse, ChecklistStatus, ResponseStatus, ChecklistContext } from '../types';
import { normalizeTrim } from './inputHelpers';

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
  device_info: string | null;
  notes: string | null;
  workshop_id: string | null;
  odometer_km: number | null;
  // join fields
  checklist_templates?: { name: string; context: string } | null;
  vehicles?: { license_plate: string } | null;
  profiles?: { name: string } | null;
  workshops?: { name: string } | null;
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
    filledBy: row.filled_by,
    filledByName: row.profiles?.name ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    status: row.status as ChecklistStatus,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    deviceInfo: row.device_info ?? undefined,
    notes: row.notes ?? undefined,
    workshopId: row.workshop_id ?? undefined,
    workshopName: row.workshops?.name ?? undefined,
    odometerKm: row.odometer_km ?? undefined,
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

