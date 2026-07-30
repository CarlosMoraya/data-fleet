import { describe, expect, it } from 'vitest';

import {
  canClassifyFleetTicket,
  canHandleFleetTicket,
  canManageTelegramSettings,
  canOpenFleetTicketReport,
  canOpenSosTicket,
  filterFleetTicketsByCard,
  fleetTicketCriticalityColor,
  fleetTicketCriticalityLabel,
  fleetTicketSourceLabel,
  fleetTicketStatusLabel,
  getFleetTicketCounts,
  isUrgentFleetTicket,
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
