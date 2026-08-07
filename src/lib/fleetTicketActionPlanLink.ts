import { isFleetTicketReadOnly } from './fleetTicketRules';

import type { FleetTicketStatus } from '../types/fleetTicket';

export function hasActionPlan(ticketId: string, ticketIdsWithPlan: ReadonlySet<string>): boolean {
  return ticketIdsWithPlan.has(ticketId);
}

export function fleetTicketActionPlanLabel(status: FleetTicketStatus, hasPlan: boolean): string | null {
  if (!hasPlan) return null;
  return isFleetTicketReadOnly(status) ? 'Encerrado com plano de ação' : 'Com plano de ação';
}
