import { evaluateOdometerTolerance } from './odometerToleranceValidation';
import { getRoleRank } from './rolePermissions';

import type {
  FleetTicket,
  FleetTicketCardFilter,
  FleetTicketCounts,
  FleetTicketCriticality,
  FleetTicketSource,
  FleetTicketSosType,
  FleetTicketStatus,
  FleetTicketStatusFilter,
} from '../types/fleetTicket';
import type { Role } from '../types/role';

export function fleetTicketSourceLabel(source: FleetTicketSource): string {
  return source === 'sos' ? 'S.O.S.' : 'Chamado';
}

export function fleetTicketSosTypeLabel(type: FleetTicketSosType): string {
  const labels: Record<FleetTicketSosType, string> = {
    breakdown: 'Veículo enguiçado',
    collision: 'Colisão/Sinistro',
    theft: 'Roubo do veículo',
  };
  return labels[type];
}

export function fleetTicketCriticalityLabel(criticality?: FleetTicketCriticality): string {
  if (!criticality) return 'Não classificado';
  const labels: Record<FleetTicketCriticality, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
  };
  return labels[criticality];
}

export function fleetTicketCriticalityColor(criticality?: FleetTicketCriticality): string {
  const colors: Record<FleetTicketCriticality, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-emerald-100 text-emerald-700',
  };
  return criticality ? colors[criticality] : 'bg-zinc-100 text-zinc-600';
}

export function fleetTicketStatusLabel(status: FleetTicketStatus): string {
  const labels: Record<FleetTicketStatus, string> = {
    open: 'Aberto',
    in_analysis: 'Em análise',
    in_progress: 'Em andamento',
    resolved: 'Resolvido',
    closed: 'Encerrado',
    cancelled: 'Cancelado',
  };
  return labels[status];
}

export function fleetTicketStatusColor(status: FleetTicketStatus): string {
  const colors: Record<FleetTicketStatus, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_analysis: 'bg-violet-100 text-violet-700',
    in_progress: 'bg-orange-100 text-orange-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-zinc-100 text-zinc-600',
    cancelled: 'bg-red-100 text-red-700',
  };
  return colors[status];
}

export function isOpenFleetTicketStatus(status: FleetTicketStatus): boolean {
  return status === 'open' || status === 'in_analysis' || status === 'in_progress';
}

export function isUrgentFleetTicket(
  ticket: Pick<FleetTicket, 'source' | 'criticality' | 'status'>,
): boolean {
  if (!isOpenFleetTicketStatus(ticket.status)) return false;
  return ticket.source === 'sos' || ticket.criticality === 'critical' || ticket.criticality === 'high';
}

export function getFleetTicketCounts(tickets: FleetTicket[]): FleetTicketCounts {
  return tickets.reduce<FleetTicketCounts>((counts, ticket) => {
    counts.all += 1;
    if (ticket.source === 'sos') counts.sos += 1;
    if (ticket.source === 'report' && !ticket.criticality) counts.unclassified += 1;
    if (ticket.criticality) counts[ticket.criticality] += 1;
    return counts;
  }, { sos: 0, unclassified: 0, critical: 0, high: 0, medium: 0, low: 0, all: 0 });
}

export function filterFleetTicketsByCard(
  tickets: FleetTicket[],
  filter: FleetTicketCardFilter,
): FleetTicket[] {
  if (filter === 'all') return tickets;
  if (filter === 'sos') return tickets.filter((ticket) => ticket.source === 'sos');
  if (filter === 'unclassified') {
    return tickets.filter((ticket) => ticket.source === 'report' && !ticket.criticality);
  }
  return tickets.filter((ticket) => ticket.criticality === filter);
}

function urgencyScore(ticket: FleetTicket): number {
  if (ticket.source === 'sos') return 0;
  if (ticket.criticality === 'critical') return 1;
  if (ticket.criticality === 'high') return 2;
  if (ticket.criticality === 'medium') return 3;
  if (ticket.criticality === 'low') return 4;
  return 5;
}

export function sortFleetTicketsByUrgency(tickets: FleetTicket[]): FleetTicket[] {
  return [...tickets].sort((a, b) => {
    const scoreDifference = urgencyScore(a) - urgencyScore(b);
    if (scoreDifference !== 0) return scoreDifference;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function canOpenSosTicket(role: Role | null | undefined): boolean {
  return role === 'Driver';
}

export function canOpenFleetTicketReport(role: Role | null | undefined): boolean {
  return role === 'Yard Auditor' || role === 'Operations Manager' ||
    getRoleRank(role ?? undefined) >= getRoleRank('Fleet Assistant');
}

export function canClassifyFleetTicket(role: Role | null | undefined): boolean {
  return role === 'Admin Master' || getRoleRank(role ?? undefined) >= getRoleRank('Fleet Analyst');
}

export function canHandleFleetTicket(role: Role | null | undefined): boolean {
  return role === 'Admin Master' || (
    role !== 'Operations Manager' &&
    getRoleRank(role ?? undefined) >= getRoleRank('Fleet Assistant')
  );
}

export function canManageTelegramSettings(role: Role | null | undefined): boolean {
  return role === 'Coordinator' || role === 'Manager' || role === 'Director' || role === 'Admin Master';
}

export function canEditFleetTicketCriticality(role: Role | null | undefined): boolean {
  return canHandleFleetTicket(role);
}

export function isFleetTicketReadOnly(status: FleetTicketStatus): boolean {
  return status === 'resolved' || status === 'closed' || status === 'cancelled';
}

export function requiresFleetTicketPhoto(
  source: FleetTicketSource,
  criticality?: FleetTicketCriticality,
): boolean {
  return source === 'sos' || criticality === 'critical';
}

export const FLEET_TICKET_CRITICALITY_DESCRIPTIONS: Record<FleetTicketCriticality, string> = {
  critical: 'Para problemas em que a segurança do condutor está em risco',
  high: 'Para problemas em que uma parada não programada pode gerar um prejuízo ao equipamento no curto prazo',
  medium: 'Para problemas em que uma parada não programada pode gerar um prejuízo ao equipamento no médio prazo',
  low: 'Para problemas em que uma parada não programada pode gerar um prejuízo ao equipamento no longo prazo',
};

export interface FleetTicketOdometerInput {
  rawValue: string;
  lastOfficialKm: number | null;
  lastReadingAt: string | null;
  tolerancePerDay: number | null;
  now?: Date;
}

export type FleetTicketOdometerAdvice =
  | { level: 'empty' }
  | { level: 'invalid'; message: string }
  | { level: 'ok'; value: number }
  | { level: 'below'; value: number; message: string }
  | { level: 'above'; value: number; message: string };

export function evaluateFleetTicketOdometer(input: FleetTicketOdometerInput): FleetTicketOdometerAdvice {
  const trimmed = input.rawValue.trim();
  if (!trimmed) {
    return { level: 'empty' };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { level: 'invalid', message: 'Informe o Km usando apenas números.' };
  }

  const result = evaluateOdometerTolerance({
    rawValue: trimmed,
    lastValidKm: input.lastOfficialKm,
    lastReadingAt: input.lastReadingAt,
    initialKm: null,
    tolerancePerDay: input.tolerancePerDay,
    dayInterval: null,
    now: input.now,
    mustExceed: false,
  });

  if (result.ok === false) {
    return { level: 'below', value: Number(trimmed), message: result.message };
  }

  if (result.requiresPhoto) {
    return {
      level: 'above',
      value: result.value,
      message: `O Km informado está ${result.exceededBy.toLocaleString('pt-BR')} km acima do esperado para o período (máximo estimado: ${result.expectedMaxKm.toLocaleString('pt-BR')} km). Confirme se está correto.`,
    };
  }

  return { level: 'ok', value: result.value };
}

export function buildFleetTicketFilterOptions(
  tickets: FleetTicket[],
  field: 'vehicleModelSnapshot' | 'vehicleOwnerSnapshot' | 'shipperNameSnapshot' | 'operationalUnitNameSnapshot',
): string[] {
  const values = new Set<string>();
  for (const ticket of tickets) {
    const value = ticket[field];
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function filterFleetTicketsByVehicleAttributes(
  tickets: FleetTicket[],
  filters: { model: string; owner: string; shipper: string; unit: string },
): FleetTicket[] {
  return tickets.filter((ticket) => {
    if (filters.model && ticket.vehicleModelSnapshot !== filters.model) return false;
    if (filters.owner && ticket.vehicleOwnerSnapshot !== filters.owner) return false;
    if (filters.shipper && ticket.shipperNameSnapshot !== filters.shipper) return false;
    if (filters.unit && ticket.operationalUnitNameSnapshot !== filters.unit) return false;
    return true;
  });
}

export const FLEET_TICKET_STATUS_FILTER_OPTIONS: readonly FleetTicketStatus[] = [
  'open',
  'in_analysis',
  'in_progress',
  'resolved',
  'closed',
  'cancelled',
];

export function isFleetTicketStatusFilter(value: unknown): value is FleetTicketStatusFilter {
  return value === '' || FLEET_TICKET_STATUS_FILTER_OPTIONS.includes(value as FleetTicketStatus);
}

export function filterFleetTicketsByStatus(
  tickets: FleetTicket[],
  status: FleetTicketStatusFilter,
): FleetTicket[] {
  if (status === '') return tickets;
  return tickets.filter((ticket) => ticket.status === status);
}
