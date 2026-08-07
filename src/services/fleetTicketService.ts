import {
  fleetTicketEventFromRow,
  fleetTicketFromRow,
  type FleetTicketEventRow,
  type FleetTicketRow,
} from '../lib/fleetTicketMappers';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import {
  getFleetTicketAttachmentSignedUrl,
  uploadFleetTicketAttachment,
} from '../lib/storageHelpers';
import { supabase } from '../lib/supabase';

import type {
  CreateFleetTicketReportInput,
  CreateSosTicketInput,
  FleetTicket,
  FleetTicketCriticality,
  FleetTicketEvent,
  FleetTicketStatus,
} from '../types/fleetTicket';

type TicketFileUploadResult = { paths: string[]; warnings: string[] };

async function uploadTicketFiles(
  clientId: string,
  ticketId: string,
  files: File[],
): Promise<TicketFileUploadResult> {
  const paths: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    try {
      paths.push(await uploadFleetTicketAttachment(clientId, ticketId, file));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Um ou mais anexos não foram enviados.');
    }
  }

  return { paths, warnings };
}

async function appendTicketFiles(
  ticketId: string,
  paths: string[],
  warnings: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.rpc('append_fleet_ticket_attachments', {
    p_ticket_id: ticketId,
    p_attachment_paths: paths,
  });
  if (error) {
    warnings.push(error.message || 'Um ou mais anexos não foram registrados.');
  }
}

async function notifyTicketTelegramBestEffort(
  ticketId: string,
  reason: 'sos_created' | 'critical_classified' | 'high_classified',
): Promise<string | undefined> {
  try {
    await invokeEdgeFunction('notify-fleet-ticket-telegram', { action: 'ticket', ticketId, reason });
    return undefined;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : 'Não foi possível enviar a notificação Telegram.';
  }
}

export async function listFleetTickets(clientId?: string): Promise<FleetTicket[]> {
  let query = supabase
    .from('fleet_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as FleetTicketRow[]).map(fleetTicketFromRow);
}

export async function listFleetTicketEvents(ticketId: string): Promise<FleetTicketEvent[]> {
  const { data, error } = await supabase
    .from('fleet_ticket_events')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as FleetTicketEventRow[]).map(fleetTicketEventFromRow);
}

export async function createSosTicket(input: CreateSosTicketInput): Promise<{
  ticketId: string;
  telegramWarning?: string;
  uploadWarnings: string[];
}> {
  const { data, error } = await supabase.rpc('create_sos_ticket', {
    p_vehicle_id: input.vehicleId,
    p_sos_type: input.sosType,
    p_description: input.description,
    p_location_text: input.locationText ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_location_status: input.locationStatus,
    p_odometer_km: input.odometerKm,
  });
  if (error) throw error;

  const ticketId = data as string;
  const uploadResult = await uploadTicketFiles(input.clientId, ticketId, input.files ?? []);
  const uploadWarnings = [...uploadResult.warnings];
  await appendTicketFiles(ticketId, uploadResult.paths, uploadWarnings);

  const telegramWarning = await notifyTicketTelegramBestEffort(ticketId, 'sos_created');
  return { ticketId, telegramWarning, uploadWarnings };
}

export async function createFleetTicketReport(input: CreateFleetTicketReportInput): Promise<{
  ticketId: string;
  uploadWarnings: string[];
}> {
  const { data, error } = await supabase.rpc('create_fleet_ticket_report', {
    p_vehicle_id: input.vehicleId,
    p_title: input.title,
    p_description: input.description,
    p_odometer_km: input.odometerKm,
    p_criticality: input.criticality,
  });
  if (error) throw error;

  const ticketId = data as string;
  const uploadResult = await uploadTicketFiles(input.clientId, ticketId, input.files ?? []);
  const uploadWarnings = [...uploadResult.warnings];
  await appendTicketFiles(ticketId, uploadResult.paths, uploadWarnings);

  return { ticketId, uploadWarnings };
}

export async function classifyFleetTicket(
  ticketId: string,
  criticality: FleetTicketCriticality,
): Promise<{ telegramWarning?: string }> {
  const { error } = await supabase.rpc('classify_fleet_ticket', {
    p_ticket_id: ticketId,
    p_criticality: criticality,
  });
  if (error) throw error;

  if (criticality !== 'critical' && criticality !== 'high') return {};
  const telegramWarning = await notifyTicketTelegramBestEffort(
    ticketId,
    criticality === 'critical' ? 'critical_classified' : 'high_classified',
  );
  return { telegramWarning };
}

export async function assignFleetTicketToSelf(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_fleet_ticket_to_self', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
}

export async function updateFleetTicketStatus(
  ticketId: string,
  status: FleetTicketStatus,
  resolutionNotes?: string,
): Promise<void> {
  const { error } = await supabase.rpc('update_fleet_ticket_status', {
    p_ticket_id: ticketId,
    p_status: status,
    p_resolution_notes: resolutionNotes ?? null,
  });
  if (error) throw error;
}

export async function getFleetTicketAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  const results = await Promise.all(paths.map(async (path) => {
    try {
      return [path, await getFleetTicketAttachmentSignedUrl(path)] as const;
    } catch {
      return null;
    }
  }));

  return Object.fromEntries(results.filter((result): result is readonly [string, string] => result !== null));
}

export async function listVehiclesForSos(): Promise<Array<{ id: string; licensePlate: string }>> {
  const { data, error } = await supabase.rpc('list_vehicles_for_checklist_selection');
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id),
      licensePlate: String(row.license_plate ?? row.licensePlate ?? ''),
    }))
    .filter((vehicle) => vehicle.id !== 'undefined' && vehicle.licensePlate.length > 0);
}

export async function listFleetTicketIdsWithActionPlan(ticketIds: string[]): Promise<Set<string>> {
  if (ticketIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('action_plans')
    .select('fleet_ticket_id')
    .in('fleet_ticket_id', ticketIds);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row: { fleet_ticket_id: string | null }) => row.fleet_ticket_id)
      .filter((id): id is string => !!id),
  );
}

export async function listVehiclesForFleetTicketReport(): Promise<Array<{ id: string; licensePlate: string }>> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, license_plate')
    .eq('active', true)
    .order('license_plate');
  if (error) throw error;

  return ((data ?? []) as Array<{ id: string; license_plate: string }>).map((row) => ({
    id: row.id,
    licensePlate: row.license_plate,
  }));
}
