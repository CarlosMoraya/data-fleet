import { describe, expect, it } from 'vitest';

import {
  FLEET_TICKET_STATUS_FILTER_OPTIONS,
  buildFleetTicketFilterOptions,
  canClassifyFleetTicket,
  canEditFleetTicketCriticality,
  canHandleFleetTicket,
  canManageTelegramSettings,
  canOpenFleetTicketReport,
  canOpenSosTicket,
  evaluateFleetTicketOdometer,
  filterFleetTicketsByCard,
  filterFleetTicketsByStatus,
  filterFleetTicketsByVehicleAttributes,
  fleetTicketCriticalityColor,
  fleetTicketCriticalityLabel,
  fleetTicketSourceLabel,
  fleetTicketStatusLabel,
  getFleetTicketCounts,
  isFleetTicketReadOnly,
  isFleetTicketStatusFilter,
  isUrgentFleetTicket,
  requiresFleetTicketPhoto,
  sortFleetTicketsByUrgency,
} from './fleetTicketRules';

import type { FleetTicket } from '../types/fleetTicket';

function ticket(overrides: Partial<FleetTicket> = {}): FleetTicket {
  return {
    id: 'ticket-1',
    clientId: 'client-1',
    source: 'report',
    openedBy: 'user-1',
    openedByRole: 'Yard Auditor',
    openedByNameSnapshot: 'Maria',
    vehicleId: 'vehicle-1',
    vehicleLicensePlateSnapshot: 'ABC1D23',
    title: 'Problema operacional',
    status: 'open',
    attachmentPaths: [],
    createdAt: '2026-07-29T10:00:00Z',
    updatedAt: '2026-07-29T10:00:00Z',
    ...overrides,
  };
}

describe('fleet ticket labels and colors', () => {
  it('returns source, criticality and status labels', () => {
    expect(fleetTicketSourceLabel('sos')).toBe('S.O.S.');
    expect(fleetTicketCriticalityLabel()).toBe('Não classificado');
    expect(fleetTicketCriticalityLabel('critical')).toBe('Crítico');
    expect(fleetTicketStatusLabel('in_progress')).toBe('Em andamento');
  });

  it('returns visual colors for criticality', () => {
    expect(fleetTicketCriticalityColor('critical')).toContain('red');
    expect(fleetTicketCriticalityColor('high')).toContain('orange');
    expect(fleetTicketCriticalityColor()).toContain('zinc');
  });
});

describe('fleet ticket cards and sorting', () => {
  const tickets = [
    ticket({ id: 'sos', source: 'sos', criticality: 'critical', title: 'Emergência' }),
    ticket({ id: 'critical', criticality: 'critical', createdAt: '2026-07-29T09:00:00Z' }),
    ticket({ id: 'high', criticality: 'high' }),
    ticket({ id: 'unclassified', criticality: undefined }),
  ];

  it('counts every card category', () => {
    expect(getFleetTicketCounts(tickets)).toEqual({ sos: 1, unclassified: 1, critical: 2, high: 1, medium: 0, low: 0, all: 4 });
  });

  it('filters S.O.S. tickets', () => {
    expect(filterFleetTicketsByCard(tickets, 'sos').map((item) => item.id)).toEqual(['sos']);
  });

  it('filters unclassified reports', () => {
    expect(filterFleetTicketsByCard(tickets, 'unclassified').map((item) => item.id)).toEqual(['unclassified']);
  });

  it('sorts S.O.S. before critical and high', () => {
    expect(sortFleetTicketsByUrgency(tickets).map((item) => item.id)).toEqual(['sos', 'critical', 'high', 'unclassified']);
  });
});

describe('fleet ticket urgency and permissions', () => {
  it('keeps S.O.S. urgent while open', () => {
    expect(isUrgentFleetTicket(ticket({ source: 'sos', criticality: 'critical' }))).toBe(true);
  });

  it('does not count resolved tickets as urgent', () => {
    expect(isUrgentFleetTicket(ticket({ criticality: 'critical', status: 'resolved' }))).toBe(false);
    expect(isUrgentFleetTicket(ticket({ criticality: 'high', status: 'closed' }))).toBe(false);
  });

  it('applies role permissions explicitly', () => {
    expect(canOpenSosTicket('Driver')).toBe(true);
    expect(canOpenFleetTicketReport('Yard Auditor')).toBe(true);
    expect(canOpenFleetTicketReport('Operations Manager')).toBe(true);
    expect(canClassifyFleetTicket('Fleet Analyst')).toBe(true);
    expect(canHandleFleetTicket('Fleet Assistant')).toBe(true);
    expect(canHandleFleetTicket('Operations Manager')).toBe(false);
    expect(canManageTelegramSettings('Coordinator')).toBe(true);
    expect(canManageTelegramSettings('Fleet Analyst')).toBe(false);
  });
});

describe('canEditFleetTicketCriticality', () => {
  it('excludes Operations Manager (regression fixed this session)', () => {
    expect(canEditFleetTicketCriticality('Operations Manager')).toBe(false);
  });

  it('excludes Yard Auditor', () => {
    expect(canEditFleetTicketCriticality('Yard Auditor')).toBe(false);
  });

  it('allows Fleet Assistant and above', () => {
    expect(canEditFleetTicketCriticality('Fleet Assistant')).toBe(true);
    expect(canEditFleetTicketCriticality('Fleet Analyst')).toBe(true);
    expect(canEditFleetTicketCriticality('Coordinator')).toBe(true);
    expect(canEditFleetTicketCriticality('Admin Master')).toBe(true);
  });

  it('denies missing role', () => {
    expect(canEditFleetTicketCriticality(null)).toBe(false);
    expect(canEditFleetTicketCriticality(undefined)).toBe(false);
  });
});

describe('isFleetTicketReadOnly', () => {
  it('is false for active statuses', () => {
    expect(isFleetTicketReadOnly('open')).toBe(false);
    expect(isFleetTicketReadOnly('in_analysis')).toBe(false);
    expect(isFleetTicketReadOnly('in_progress')).toBe(false);
  });

  it('is true for terminal statuses', () => {
    expect(isFleetTicketReadOnly('resolved')).toBe(true);
    expect(isFleetTicketReadOnly('closed')).toBe(true);
    expect(isFleetTicketReadOnly('cancelled')).toBe(true);
  });
});

describe('requiresFleetTicketPhoto', () => {
  it('requires photo for S.O.S. or critical reports', () => {
    expect(requiresFleetTicketPhoto('sos', 'critical')).toBe(true);
    expect(requiresFleetTicketPhoto('report', 'critical')).toBe(true);
  });

  it('does not require photo for non-critical reports', () => {
    expect(requiresFleetTicketPhoto('report', 'high')).toBe(false);
    expect(requiresFleetTicketPhoto('report', undefined)).toBe(false);
  });
});

describe('evaluateFleetTicketOdometer', () => {
  it('accepts a value within tolerance', () => {
    expect(evaluateFleetTicketOdometer({
      rawValue: '92400',
      lastOfficialKm: 91800,
      lastReadingAt: null,
      tolerancePerDay: null,
    })).toEqual({ level: 'ok', value: 92400 });
  });

  it('rejects non-numeric input', () => {
    expect(evaluateFleetTicketOdometer({
      rawValue: 'abc',
      lastOfficialKm: null,
      lastReadingAt: null,
      tolerancePerDay: null,
    })).toMatchObject({ level: 'invalid' });
  });

  it('flags empty input', () => {
    expect(evaluateFleetTicketOdometer({
      rawValue: '  ',
      lastOfficialKm: null,
      lastReadingAt: null,
      tolerancePerDay: null,
    })).toEqual({ level: 'empty' });
  });

  it('warns when the value is below the last official reading', () => {
    const advice = evaluateFleetTicketOdometer({
      rawValue: '90000',
      lastOfficialKm: 91800,
      lastReadingAt: null,
      tolerancePerDay: null,
    });
    expect(advice.level).toBe('below');
    expect((advice as { message: string }).message).toContain('91.800');
  });

  it('warns when the value exceeds the expected tolerance for the period', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const advice = evaluateFleetTicketOdometer({
      rawValue: '95000',
      lastOfficialKm: 91800,
      lastReadingAt: twoDaysAgo,
      tolerancePerDay: 500,
    });
    expect(advice.level).toBe('above');
  });

  it('never flags divergence without a reference reading', () => {
    expect(evaluateFleetTicketOdometer({
      rawValue: '92400',
      lastOfficialKm: null,
      lastReadingAt: null,
      tolerancePerDay: null,
    })).toEqual({ level: 'ok', value: 92400 });
  });
});

describe('buildFleetTicketFilterOptions', () => {
  const tickets = [
    ticket({ id: 'a', vehicleModelSnapshot: 'Volvo FH' }),
    ticket({ id: 'b', vehicleModelSnapshot: 'Scania R450' }),
    ticket({ id: 'c', vehicleModelSnapshot: 'Volvo FH' }),
    ticket({ id: 'd', vehicleModelSnapshot: undefined }),
  ];

  it('removes duplicates, removes undefined and sorts with correct accentuation', () => {
    expect(buildFleetTicketFilterOptions(tickets, 'vehicleModelSnapshot')).toEqual(['Scania R450', 'Volvo FH']);
  });
});

describe('filterFleetTicketsByVehicleAttributes', () => {
  const tickets = [
    ticket({
      id: 'a',
      vehicleModelSnapshot: 'Volvo FH',
      vehicleOwnerSnapshot: 'Transportadora Beta',
      shipperNameSnapshot: 'Embarcador X',
      operationalUnitNameSnapshot: 'Base Sul',
    }),
    ticket({
      id: 'b',
      vehicleModelSnapshot: 'Scania R450',
      vehicleOwnerSnapshot: 'Transportadora Beta',
      shipperNameSnapshot: 'Embarcador Y',
      operationalUnitNameSnapshot: 'Base Norte',
    }),
  ];

  it('returns everything when all filters are empty', () => {
    expect(filterFleetTicketsByVehicleAttributes(tickets, { model: '', owner: '', shipper: '', unit: '' }))
      .toHaveLength(2);
  });

  it('reduces the list with a single filter', () => {
    const result = filterFleetTicketsByVehicleAttributes(tickets, { model: 'Volvo FH', owner: '', shipper: '', unit: '' });
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('combines two filters with logical AND', () => {
    const result = filterFleetTicketsByVehicleAttributes(tickets, {
      model: '',
      owner: 'Transportadora Beta',
      shipper: 'Embarcador Y',
      unit: '',
    });
    expect(result.map((item) => item.id)).toEqual(['b']);
  });

  it('returns an empty array when nothing matches', () => {
    const result = filterFleetTicketsByVehicleAttributes(tickets, { model: 'Inexistente', owner: '', shipper: '', unit: '' });
    expect(result).toEqual([]);
  });
});

describe('filterFleetTicketsByStatus', () => {
  const list = [
    ticket({ id: 'a', status: 'open' }),
    ticket({ id: 'b', status: 'closed' }),
  ];

  it('reduces the list to a single matching status', () => {
    expect(filterFleetTicketsByStatus(list, 'open').map((item) => item.id)).toEqual(['a']);
  });

  it('returns all tickets when the filter is empty', () => {
    expect(filterFleetTicketsByStatus(list, '')).toHaveLength(2);
  });

  it('returns an empty array for a status with no occurrences', () => {
    expect(filterFleetTicketsByStatus(list, 'cancelled')).toHaveLength(0);
  });

  it('handles an empty list gracefully', () => {
    expect(filterFleetTicketsByStatus([], 'open')).toEqual([]);
  });
});

describe('isFleetTicketStatusFilter', () => {
  it('accepts empty string and all valid statuses', () => {
    expect(isFleetTicketStatusFilter('')).toBe(true);
    expect(FLEET_TICKET_STATUS_FILTER_OPTIONS.every(isFleetTicketStatusFilter)).toBe(true);
  });

  it('rejects unknown strings', () => {
    expect(isFleetTicketStatusFilter('aberto')).toBe(false);
    expect(isFleetTicketStatusFilter('archived')).toBe(false);
    expect(isFleetTicketStatusFilter('ALL')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isFleetTicketStatusFilter(null)).toBe(false);
    expect(isFleetTicketStatusFilter(undefined)).toBe(false);
    expect(isFleetTicketStatusFilter(0)).toBe(false);
    expect(isFleetTicketStatusFilter({})).toBe(false);
  });
});
