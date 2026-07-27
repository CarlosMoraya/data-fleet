import { supabase } from '../lib/supabase';
import { vehicleLoanFromRow, vehicleLoanFromRpcRow, type VehicleLoanRow, type VehicleLoanRpcRow, type VehicleLoanNotificationRow } from '../lib/vehicleLoanMappers';
import type { VehicleLoan, VehicleLoanEndedReason, VehicleLoanNotification } from '../types/vehicleLoan';

// ─── Service: vehicle loans ─────────────────────────────────────────────────
// Encapsulates Supabase access to vehicle_loans / RPCs. Every function checks
// `error` and throws it (never silently swallow RPC errors — see MEMORY).

export interface CreateVehicleLoanParams {
  clientId: string;
  vehicleId: string;
  driverId: string;
  checklistId: string;
  notes: string;
}

export interface CompleteVehicleLoanParams {
  loanId: string;
  returnChecklistId?: string | null;
  endedReason: VehicleLoanEndedReason;
  endedBy: string;
  endedNotes?: string;
}

export async function createVehicleLoan(params: CreateVehicleLoanParams): Promise<string> {
  const { data, error } = await supabase.rpc('create_vehicle_loan', {
    p_client_id: params.clientId,
    p_vehicle_id: params.vehicleId,
    p_driver_id: params.driverId,
    p_checklist_id: params.checklistId,
    p_notes: params.notes,
  });
  if (error) throw error;
  return data as string;
}

export async function completeVehicleLoan(params: CompleteVehicleLoanParams): Promise<void> {
  const { error } = await supabase.rpc('complete_vehicle_loan', {
    p_loan_id: params.loanId,
    p_return_checklist_id: params.returnChecklistId ?? null,
    p_ended_reason: params.endedReason,
    p_ended_by: params.endedBy,
    p_ended_notes: params.endedNotes ?? null,
  });
  if (error) throw error;
}

export async function getActiveVehicleLoan(vehicleId: string): Promise<VehicleLoan | null> {
  const { data, error } = await supabase.rpc('get_active_vehicle_loan', {
    p_vehicle_id: vehicleId,
  });
  if (error) throw error;
  const rows = (data ?? []) as VehicleLoanRpcRow[];
  if (rows.length === 0) return null;
  return vehicleLoanFromRpcRow(rows[0]);
}

export async function listVehicleLoansByVehicle(vehicleId: string): Promise<VehicleLoan[]> {
  const { data, error } = await supabase.rpc('get_vehicle_loans_by_vehicle', {
    p_vehicle_id: vehicleId,
  });
  if (error) throw error;
  return ((data ?? []) as VehicleLoanRpcRow[]).map(vehicleLoanFromRpcRow);
}

export async function getActiveLoansForVehicles(vehicleIds: string[]): Promise<Map<string, VehicleLoan>> {
  const result = new Map<string, VehicleLoan>();
  if (vehicleIds.length === 0) return result;
  const { data, error } = await supabase
    .from('vehicle_loans')
    .select('*, drivers!driver_id(name)')
    .in('vehicle_id', vehicleIds)
    .eq('status', 'active');
  if (error) throw error;
  for (const row of (data ?? []) as VehicleLoanRow[]) {
    result.set(row.vehicle_id, vehicleLoanFromRow(row));
  }
  return result;
}

export async function getLoanDeliveryChecklistIds(checklistIds: string[]): Promise<Set<string>> {
  if (checklistIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('vehicle_loans')
    .select('delivery_checklist_id')
    .in('delivery_checklist_id', checklistIds);
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ delivery_checklist_id: string | null }>)
    .map((r) => r.delivery_checklist_id)
    .filter((id): id is string => !!id);
  return new Set(ids);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_vehicle_loan_notification_read', {
    p_notification_id: id,
  });
  if (error) throw error;
}

export async function listUnreadNotificationsForDriver(profileId: string): Promise<VehicleLoanNotification[]> {
  // A driver profile may own multiple driver rows across tenants; the RLS
  // policy only returns notifications whose recipient belongs to a driver
  // the caller can read (recipient.driver.profile_id = auth.uid() or
  // same-tenant manager). Filter by those driver ids.
  const { data: driverRows, error: driversError } = await supabase
    .from('drivers')
    .select('id')
    .eq('profile_id', profileId);
  if (driversError) throw driversError;
  const driverIds = (driverRows ?? []).map((r: { id: string }) => r.id);
  if (driverIds.length === 0) return [];

  const { data, error } = await supabase
    .from('vehicle_loan_notifications')
    .select('*')
    .in('recipient_driver_id', driverIds)
    .is('read_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as VehicleLoanNotificationRow[];
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    loanId: r.loan_id,
    recipientDriverId: r.recipient_driver_id,
    kind: r.kind as VehicleLoanNotification['kind'],
    payload: r.payload as VehicleLoanNotification['payload'],
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
}