import { FLEET_TICKET_SLA_DEFAULTS } from './fleetTicketSla';
import { normalizeTrim } from './inputHelpers';

import type {
  ClientFleetTicketSlaSettings,
  ClientTelegramSettings,
  FleetTicket,
  FleetTicketEvent,
  FleetTicketEventType,
  FleetTicketSource,
  FleetTicketSosType,
  FleetTicketCriticality,
  FleetTicketStatus,
  FleetTicketLocationStatus,
} from '../types/fleetTicket';

export interface FleetTicketRow {
  id: string;
  client_id: string;
  source: FleetTicketSource | string;
  opened_by: string;
  opened_by_role: string;
  opened_by_name_snapshot: string;
  driver_id?: string | null;
  driver_name_snapshot?: string | null;
  vehicle_id: string;
  vehicle_license_plate_snapshot: string;
  sos_type?: FleetTicketSosType | string | null;
  title: string;
  description?: string | null;
  criticality?: FleetTicketCriticality | string | null;
  classified_by?: string | null;
  classified_by_name_snapshot?: string | null;
  classified_at?: string | null;
  status: FleetTicketStatus | string;
  assigned_to?: string | null;
  assigned_to_name_snapshot?: string | null;
  assigned_at?: string | null;
  resolved_by?: string | null;
  resolved_by_name_snapshot?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_status?: FleetTicketLocationStatus | string | null;
  location_text?: string | null;
  attachment_paths?: string[] | null;
  telegram_notified_at?: string | null;
  telegram_last_error?: string | null;
  created_at: string;
  updated_at: string;
  ticket_number?: string | null;
  odometer_km?: number | string | null;
  vehicle_model_snapshot?: string | null;
  vehicle_owner_snapshot?: string | null;
  shipper_name_snapshot?: string | null;
  operational_unit_name_snapshot?: string | null;
}

export interface FleetTicketEventRow {
  id: string;
  client_id: string;
  ticket_id: string;
  event_type: FleetTicketEventType | string;
  actor_id?: string | null;
  actor_name_snapshot?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface ClientTelegramSettingsRow {
  client_id: string;
  enabled: boolean;
  chat_id?: string | null;
  notify_sos: boolean;
  notify_critical: boolean;
  notify_high: boolean;
  updated_by?: string | null;
  updated_at?: string | null;
}

export function fleetTicketFromRow(row: FleetTicketRow): FleetTicket {
  return {
    id: row.id,
    clientId: row.client_id,
    source: row.source as FleetTicketSource,
    openedBy: row.opened_by,
    openedByRole: row.opened_by_role,
    openedByNameSnapshot: row.opened_by_name_snapshot,
    driverId: row.driver_id ?? undefined,
    driverNameSnapshot: row.driver_name_snapshot ?? undefined,
    vehicleId: row.vehicle_id,
    vehicleLicensePlateSnapshot: row.vehicle_license_plate_snapshot,
    sosType: (row.sos_type ?? undefined) as FleetTicketSosType | undefined,
    title: row.title,
    description: row.description ?? undefined,
    criticality: (row.criticality ?? undefined) as FleetTicketCriticality | undefined,
    classifiedBy: row.classified_by ?? undefined,
    classifiedByNameSnapshot: row.classified_by_name_snapshot ?? undefined,
    classifiedAt: row.classified_at ?? undefined,
    status: row.status as FleetTicketStatus,
    assignedTo: row.assigned_to ?? undefined,
    assignedToNameSnapshot: row.assigned_to_name_snapshot ?? undefined,
    assignedAt: row.assigned_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolvedByNameSnapshot: row.resolved_by_name_snapshot ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolutionNotes: row.resolution_notes ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    locationStatus: (row.location_status ?? undefined) as FleetTicketLocationStatus | undefined,
    locationText: row.location_text ?? undefined,
    attachmentPaths: Array.isArray(row.attachment_paths) ? [...row.attachment_paths] : [],
    telegramNotifiedAt: row.telegram_notified_at ?? undefined,
    telegramLastError: row.telegram_last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ticketNumber: normalizeTrim(row.ticket_number) || undefined,
    odometerKm: row.odometer_km != null ? Number(row.odometer_km) : undefined,
    vehicleModelSnapshot: normalizeTrim(row.vehicle_model_snapshot) || undefined,
    vehicleOwnerSnapshot: normalizeTrim(row.vehicle_owner_snapshot) || undefined,
    shipperNameSnapshot: normalizeTrim(row.shipper_name_snapshot) || undefined,
    operationalUnitNameSnapshot: normalizeTrim(row.operational_unit_name_snapshot) || undefined,
  };
}

export function fleetTicketEventFromRow(row: FleetTicketEventRow): FleetTicketEvent {
  return {
    id: row.id,
    clientId: row.client_id,
    ticketId: row.ticket_id,
    eventType: row.event_type as FleetTicketEventType,
    actorId: row.actor_id ?? undefined,
    actorNameSnapshot: row.actor_name_snapshot ?? undefined,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

export function telegramSettingsFromRow(
  row: ClientTelegramSettingsRow | null,
  clientId: string,
): ClientTelegramSettings {
  if (!row) {
    return {
      clientId,
      enabled: false,
      chatId: '',
      notifySos: true,
      notifyCritical: true,
      notifyHigh: false,
    };
  }

  return {
    clientId: row.client_id,
    enabled: row.enabled,
    chatId: row.chat_id ?? '',
    notifySos: row.notify_sos,
    notifyCritical: row.notify_critical,
    notifyHigh: row.notify_high,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function telegramSettingsToRow(
  settings: ClientTelegramSettings,
  userId: string,
): Partial<ClientTelegramSettingsRow> {
  return {
    client_id: settings.clientId,
    enabled: settings.enabled,
    chat_id: normalizeTrim(settings.chatId) || null,
    notify_sos: settings.notifySos,
    notify_critical: settings.notifyCritical,
    notify_high: settings.notifyHigh,
    updated_by: userId,
  };
}

export interface ClientFleetTicketSlaSettingsRow {
  client_id: string;
  open_sla_hours: number;
  assigned_sla_hours: number;
  updated_by: string | null;
  updated_at: string | null;
}

export function fleetTicketSlaSettingsFromRow(
  row: ClientFleetTicketSlaSettingsRow | null,
  clientId: string,
): ClientFleetTicketSlaSettings {
  if (!row) {
    return {
      clientId,
      openSlaHours: FLEET_TICKET_SLA_DEFAULTS.openSlaHours,
      assignedSlaHours: FLEET_TICKET_SLA_DEFAULTS.assignedSlaHours,
    };
  }

  return {
    clientId: row.client_id,
    openSlaHours: row.open_sla_hours,
    assignedSlaHours: row.assigned_sla_hours,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function fleetTicketSlaSettingsToRow(
  settings: ClientFleetTicketSlaSettings,
  userId: string,
): Partial<ClientFleetTicketSlaSettingsRow> {
  return {
    client_id: settings.clientId,
    open_sla_hours: settings.openSlaHours,
    assigned_sla_hours: settings.assignedSlaHours,
    updated_by: userId,
  };
}
