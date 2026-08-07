import { describe, expect, it } from 'vitest';

import {
  evaluateFleetTicketSla,
  filterFleetTicketsBySla,
  isFleetTicketSlaFilter,
} from './fleetTicketSla';

import type { ClientFleetTicketSlaSettings, FleetTicket, FleetTicketStatus } from '../types/fleetTicket';

const NOW = new Date('2026-08-07T12:00:00Z');
const settings: ClientFleetTicketSlaSettings = {
  clientId: 'c1',
  openSlaHours: 24,
  assignedSlaHours: 72,
};

function ticket(overrides: Partial<Pick<FleetTicket, 'status' | 'assignedTo' | 'createdAt'>>): Pick<
  FleetTicket,
  'status' | 'assignedTo' | 'createdAt'
> {
  return {
    status: 'open',
    assignedTo: undefined,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('evaluateFleetTicketSla', () => {
  it.each<FleetTicketStatus>(['resolved', 'closed', 'cancelled'])('retorna null para status %s', (status) => {
    expect(evaluateFleetTicketSla(ticket({ status }), settings, NOW)).toBeNull();
  });

  it('retorna null para createdAt inválido', () => {
    expect(evaluateFleetTicketSla(ticket({ createdAt: 'não é data' }), settings, NOW)).toBeNull();
  });

  it('chamado open sem responsável, 5h decorridas, SLA 24h', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(5) }),
      settings,
      NOW,
    );
    expect(evaluation).toMatchObject({ scope: 'open', breached: false, label: 'há 5 h' });
  });

  it('chamado open sem responsável, 30h decorridas, SLA 24h', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(30) }),
      settings,
      NOW,
    );
    expect(evaluation).toMatchObject({ breached: true, label: 'há 1 dia', scope: 'open' });
  });

  it('chamado in_progress com responsável, 30h decorridas, SLA assumido 72h', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'in_progress', assignedTo: 'u1', createdAt: hoursAgo(30) }),
      settings,
      NOW,
    );
    expect(evaluation).toMatchObject({ breached: false, scope: 'assigned' });
  });

  it('chamado in_analysis com responsável tem scope assigned', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'in_analysis', assignedTo: 'u1' }),
      settings,
      NOW,
    );
    expect(evaluation?.scope).toBe('assigned');
  });

  it('chamado in_analysis sem responsável tem scope open', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'in_analysis' }),
      settings,
      NOW,
    );
    expect(evaluation?.scope).toBe('open');
  });

  it('borda de igualdade: exatamente 24h com SLA 24h é estourado', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(24) }),
      settings,
      NOW,
    );
    expect(evaluation?.breached).toBe(true);
  });

  it('borda de rótulo: 23.9h', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(23.9) }),
      settings,
      NOW,
    );
    expect(evaluation?.label).toBe('há 23 h');
  });

  it('borda de rótulo: 24h', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(24) }),
      settings,
      NOW,
    );
    expect(evaluation?.label).toBe('há 1 dia');
  });

  it('borda de rótulo: 48h', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(48) }),
      settings,
      NOW,
    );
    expect(evaluation?.label).toBe('há 2 dias');
  });

  it('createdAt no futuro (relógio adiantado)', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(-5) }),
      settings,
      NOW,
    );
    expect(evaluation).toMatchObject({ elapsedHours: 0, label: 'há 0 h', breached: false });
  });

  it('description de estouro sem responsável contém "sem responsável"', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'open', createdAt: hoursAgo(30) }),
      settings,
      NOW,
    );
    expect(evaluation?.description).toContain('sem responsável');
  });

  it('description de estouro com responsável contém "assumidos"', () => {
    const evaluation = evaluateFleetTicketSla(
      ticket({ status: 'in_progress', assignedTo: 'u1', createdAt: hoursAgo(80) }),
      settings,
      NOW,
    );
    expect(evaluation?.description).toContain('assumidos');
  });
});

describe('filterFleetTicketsBySla', () => {
  const tickets = [
    { id: '1', status: 'open', assignedTo: undefined, createdAt: hoursAgo(30) },
    { id: '2', status: 'open', assignedTo: undefined, createdAt: hoursAgo(5) },
    { id: '3', status: 'closed', assignedTo: undefined, createdAt: hoursAgo(100) },
  ] as unknown as FleetTicket[];

  it("filtro '' devolve a lista inteira, mesma referência e ordem", () => {
    const result = filterFleetTicketsBySla(tickets, '', settings, NOW);
    expect(result).toBe(tickets);
  });

  it("filtro 'breached' devolve só os estourados e nunca inclui concluídos", () => {
    const result = filterFleetTicketsBySla(tickets, 'breached', settings, NOW);
    expect(result.map((t) => t.id)).toEqual(['1']);
  });
});

describe('isFleetTicketSlaFilter', () => {
  it.each(['', 'breached'])('%s é válido', (value) => {
    expect(isFleetTicketSlaFilter(value)).toBe(true);
  });

  it.each(['foo', null, 42])('%s é inválido', (value) => {
    expect(isFleetTicketSlaFilter(value)).toBe(false);
  });
});
