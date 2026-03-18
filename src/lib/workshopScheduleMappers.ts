import { WorkshopSchedule, WorkshopScheduleStatus } from '../types';

// ─── Tipo espelho do banco (snake_case) ─────────────────────────────────────

export interface WorkshopScheduleRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  workshop_id: string;
  scheduled_date: string;
  status: string;
  completed_at: string | null;
  checklist_id: string | null;
  notes: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  // Joins
  vehicles?: { license_plate: string } | null;
  workshops?: {
    name: string;
    address_street: string | null;
    address_number: string | null;
    address_complement: string | null;
    address_neighborhood: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
  } | null;
  profiles?: { name: string } | null;
}

// ─── Conversor: banco → frontend ────────────────────────────────────────────

export function scheduleFromRow(row: WorkshopScheduleRow): WorkshopSchedule {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    vehicleLicensePlate: row.vehicles?.license_plate ?? undefined,
    workshopId: row.workshop_id,
    workshopName: row.workshops?.name ?? undefined,
    workshopAddressStreet: row.workshops?.address_street ?? undefined,
    workshopAddressNumber: row.workshops?.address_number ?? undefined,
    workshopAddressComplement: row.workshops?.address_complement ?? undefined,
    workshopAddressNeighborhood: row.workshops?.address_neighborhood ?? undefined,
    workshopAddressCity: row.workshops?.address_city ?? undefined,
    workshopAddressState: row.workshops?.address_state ?? undefined,
    workshopAddressZip: row.workshops?.address_zip ?? undefined,
    scheduledDate: row.scheduled_date,
    status: row.status as WorkshopScheduleStatus,
    completedAt: row.completed_at ?? undefined,
    checklistId: row.checklist_id ?? undefined,
    notes: row.notes ?? undefined,
    createdBy: row.created_by,
    createdByName: row.profiles?.name ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

// ─── Conversor: frontend → banco ────────────────────────────────────────────

export function scheduleToRow(
  schedule: Partial<WorkshopSchedule>,
  clientId: string,
  createdBy: string
): {
  client_id: string;
  vehicle_id: string;
  workshop_id: string;
  scheduled_date: string;
  notes: string | null;
  created_by: string;
} {
  return {
    client_id: clientId,
    vehicle_id: schedule.vehicleId!,
    workshop_id: schedule.workshopId!,
    scheduled_date: schedule.scheduledDate!,
    notes: schedule.notes?.trim() || null,
    created_by: createdBy,
  };
}

// ─── Google Maps URL ─────────────────────────────────────────────────────────

/** Constrói URL de direções do Google Maps a partir do endereço da oficina */
export function buildGoogleMapsUrl(schedule: WorkshopSchedule): string {
  const parts = [
    schedule.workshopAddressStreet,
    schedule.workshopAddressNumber,
    schedule.workshopAddressNeighborhood,
    schedule.workshopAddressCity,
    schedule.workshopAddressState,
    schedule.workshopAddressZip,
  ].filter(Boolean);

  const address = parts.join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Formata o endereço completo da oficina para exibição */
export function formatWorkshopAddress(schedule: WorkshopSchedule): string {
  const line1Parts = [
    schedule.workshopAddressStreet,
    schedule.workshopAddressNumber,
    schedule.workshopAddressComplement,
  ].filter(Boolean);

  const line2Parts = [
    schedule.workshopAddressNeighborhood,
    schedule.workshopAddressCity && schedule.workshopAddressState
      ? `${schedule.workshopAddressCity} - ${schedule.workshopAddressState}`
      : (schedule.workshopAddressCity || schedule.workshopAddressState),
    schedule.workshopAddressZip,
  ].filter(Boolean);

  const lines = [];
  if (line1Parts.length) lines.push(line1Parts.join(', '));
  if (line2Parts.length) lines.push(line2Parts.join(', '));
  return lines.join('\n');
}
