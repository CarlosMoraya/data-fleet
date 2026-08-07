import {
  fleetTicketSlaSettingsFromRow,
  fleetTicketSlaSettingsToRow,
  type ClientFleetTicketSlaSettingsRow,
} from '../lib/fleetTicketMappers';
import {
  FLEET_TICKET_SLA_HOURS_MAX,
  FLEET_TICKET_SLA_HOURS_MIN,
} from '../lib/fleetTicketSla';
import { supabase } from '../lib/supabase';

import type { ClientFleetTicketSlaSettings } from '../types/fleetTicket';

export async function getFleetTicketSlaSettings(clientId: string): Promise<ClientFleetTicketSlaSettings> {
  const { data, error } = await supabase
    .from('client_fleet_ticket_sla_settings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return fleetTicketSlaSettingsFromRow(data as ClientFleetTicketSlaSettingsRow | null, clientId);
}

function isValidSlaHours(value: number): boolean {
  return Number.isInteger(value) && value >= FLEET_TICKET_SLA_HOURS_MIN && value <= FLEET_TICKET_SLA_HOURS_MAX;
}

export async function saveFleetTicketSlaSettings(
  settings: ClientFleetTicketSlaSettings,
  userId: string,
): Promise<ClientFleetTicketSlaSettings> {
  if (!isValidSlaHours(settings.openSlaHours) || !isValidSlaHours(settings.assignedSlaHours)) {
    throw new Error('Informe um SLA entre 1 e 8760 horas.');
  }

  const row = fleetTicketSlaSettingsToRow(settings, userId);
  const { data, error } = await supabase
    .from('client_fleet_ticket_sla_settings')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return fleetTicketSlaSettingsFromRow(data as ClientFleetTicketSlaSettingsRow, settings.clientId);
}
