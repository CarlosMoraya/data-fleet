import { isOpenFleetTicketStatus } from './fleetTicketRules';

import type { ClientFleetTicketSlaSettings, FleetTicket, FleetTicketSlaFilter } from '../types/fleetTicket';

export const FLEET_TICKET_SLA_DEFAULTS = {
  openSlaHours: 24,
  assignedSlaHours: 72,
} as const;

export const FLEET_TICKET_SLA_HOURS_MIN = 1;
export const FLEET_TICKET_SLA_HOURS_MAX = 8760;

export type FleetTicketSlaScope = 'open' | 'assigned';

export interface FleetTicketSlaEvaluation {
  scope: FleetTicketSlaScope;
  elapsedHours: number;
  slaHours: number;
  breached: boolean;
  label: string;
  description: string;
}

function formatElapsedLabel(elapsedHours: number): string {
  const hours = Math.floor(Math.max(0, elapsedHours));
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? `há ${days} dia` : `há ${days} dias`;
}

export function evaluateFleetTicketSla(
  ticket: Pick<FleetTicket, 'status' | 'assignedTo' | 'createdAt'>,
  settings: ClientFleetTicketSlaSettings,
  now?: Date,
): FleetTicketSlaEvaluation | null {
  if (!isOpenFleetTicketStatus(ticket.status)) return null;

  const created = new Date(ticket.createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const scope: FleetTicketSlaScope = ticket.assignedTo ? 'assigned' : 'open';
  const slaHours = scope === 'assigned' ? settings.assignedSlaHours : settings.openSlaHours;
  const reference = now ?? new Date();
  const elapsedHours = Math.max(0, (reference.getTime() - created.getTime()) / 3_600_000);
  const breached = elapsedHours >= slaHours;
  const label = formatElapsedLabel(elapsedHours);

  let description: string;
  if (!breached) {
    description = `Aberto ${label}`;
  } else if (scope === 'open') {
    description = `Aberto ${label} — SLA de ${slaHours} h para chamados sem responsável foi ultrapassado`;
  } else {
    description = `Aberto ${label} — SLA de ${slaHours} h para chamados assumidos foi ultrapassado`;
  }

  return { scope, elapsedHours, slaHours, breached, label, description };
}

export function filterFleetTicketsBySla(
  tickets: FleetTicket[],
  filter: FleetTicketSlaFilter,
  settings: ClientFleetTicketSlaSettings,
  now?: Date,
): FleetTicket[] {
  if (filter === '') return tickets;
  return tickets.filter((ticket) => evaluateFleetTicketSla(ticket, settings, now)?.breached === true);
}

export function isFleetTicketSlaFilter(value: unknown): value is FleetTicketSlaFilter {
  return value === '' || value === 'breached';
}
