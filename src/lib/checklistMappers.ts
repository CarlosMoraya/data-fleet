import type { Checklist, ChecklistResponse, ChecklistStatus, ResponseStatus } from '../types';
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
  // join fields
  checklist_templates?: { name: string } | null;
  vehicles?: { license_plate: string } | null;
  profiles?: { name: string } | null;
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

// ─── toRow converters ─────────────────────────────────────────────────────────

export function checklistToRow(c: Partial<Checklist>): Partial<ChecklistRow> {
  const row: Partial<ChecklistRow> = {};
  if (c.clientId !== undefined)      row.client_id = c.clientId;
  if (c.templateId !== undefined)    row.template_id = c.templateId;
  if (c.versionNumber !== undefined) row.version_number = c.versionNumber;
  if (c.vehicleId !== undefined)     row.vehicle_id = c.vehicleId ?? null;
  if (c.filledBy !== undefined)      row.filled_by = c.filledBy;
  if (c.completedAt !== undefined)   row.completed_at = c.completedAt ?? null;
  if (c.status !== undefined)        row.status = c.status;
  if (c.latitude !== undefined)      row.latitude = c.latitude ?? null;
  if (c.longitude !== undefined)     row.longitude = c.longitude ?? null;
  if (c.deviceInfo !== undefined)    row.device_info = c.deviceInfo ?? null;
  if (c.notes !== undefined)         row.notes = c.notes ? normalizeTrim(c.notes) : null;
  return row;
}

export function checklistResponseToRow(r: Partial<ChecklistResponse>): Partial<ChecklistResponseRow> {
  const row: Partial<ChecklistResponseRow> = {};
  if (r.checklistId !== undefined)  row.checklist_id = r.checklistId;
  if (r.itemId !== undefined)       row.item_id = r.itemId;
  if (r.status !== undefined)       row.status = r.status;
  if (r.observation !== undefined)  row.observation = r.observation ? normalizeTrim(r.observation) : null;
  if (r.photoUrl !== undefined)     row.photo_url = r.photoUrl ?? null;
  return row;
}
