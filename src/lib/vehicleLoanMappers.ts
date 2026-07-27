import type { VehicleLoan, VehicleLoanNotification, VehicleLoanEndedReason } from '../types/vehicleLoan';

// ─── Row types (snake_case from Supabase) ───────────────────────────────────

export interface VehicleLoanRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  driver_id: string;
  started_at: string;
  ended_at: string | null;
  delivery_checklist_id: string | null;
  return_checklist_id: string | null;
  status: string;
  notes: string;
  ended_notes: string | null;
  created_by: string;
  ended_by: string | null;
  ended_reason: string | null;
  created_at: string;
  updated_at: string;
  // join
  drivers?: { name: string } | Array<{ name: string }> | null;
}

export interface VehicleLoanRpcRow extends VehicleLoanRow {
  driver_name: string | null;
  created_by_name?: string | null;
  ended_by_name?: string | null;
  delivery_checklist_at?: string | null;
  return_checklist_at?: string | null;
}

export interface VehicleLoanNotificationRow {
  id: string;
  client_id: string;
  loan_id: string;
  recipient_driver_id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// ─── mappers ────────────────────────────────────────────────────────────────

function resolveDriverName(drivers?: VehicleLoanRow['drivers']): string | undefined {
  if (!drivers) return undefined;
  if (Array.isArray(drivers)) return drivers[0]?.name ?? undefined;
  return drivers.name ?? undefined;
}

function mapEndedReason(value: string | null): VehicleLoanEndedReason | null {
  if (value === 'return_checklist' || value === 'driver_changed' || value === 'cancelled' || value === 'other') {
    return value;
  }
  return null;
}

export function vehicleLoanFromRow(row: VehicleLoanRow): VehicleLoan {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    driverName: resolveDriverName(row.drivers),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    deliveryChecklistId: row.delivery_checklist_id,
    returnChecklistId: row.return_checklist_id,
    status: row.status as VehicleLoan['status'],
    notes: row.notes,
    endedNotes: row.ended_notes,
    createdBy: row.created_by,
    endedBy: row.ended_by,
    endedReason: mapEndedReason(row.ended_reason),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function vehicleLoanFromRpcRow(row: VehicleLoanRpcRow): VehicleLoan {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    driverName: row.driver_name ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    deliveryChecklistId: row.delivery_checklist_id,
    returnChecklistId: row.return_checklist_id,
    status: row.status as VehicleLoan['status'],
    notes: row.notes,
    endedNotes: row.ended_notes,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    endedBy: row.ended_by,
    endedByName: row.ended_by_name ?? null,
    endedReason: mapEndedReason(row.ended_reason),
    deliveryChecklistAt: row.delivery_checklist_at ?? null,
    returnChecklistAt: row.return_checklist_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function vehicleLoanNotificationFromRow(row: VehicleLoanNotificationRow): VehicleLoanNotification {
  return {
    id: row.id,
    clientId: row.client_id,
    loanId: row.loan_id,
    recipientDriverId: row.recipient_driver_id,
    kind: row.kind as VehicleLoanNotification['kind'],
    payload: row.payload as VehicleLoanNotification['payload'],
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}