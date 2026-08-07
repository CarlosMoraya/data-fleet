import { describe, expect, it } from 'vitest';

import { fleetTicketActionPlanLabel, hasActionPlan } from './fleetTicketActionPlanLink';

describe('hasActionPlan', () => {
  it('retorna true quando o id está no Set', () => {
    expect(hasActionPlan('ticket-1', new Set(['ticket-1']))).toBe(true);
  });

  it('retorna false quando o id não está no Set', () => {
    expect(hasActionPlan('ticket-1', new Set())).toBe(false);
  });
});

describe('fleetTicketActionPlanLabel', () => {
  it('retorna "Encerrado com plano de ação" para chamado closed com plano', () => {
    expect(fleetTicketActionPlanLabel('closed', true)).toBe('Encerrado com plano de ação');
  });

  it('retorna "Com plano de ação" para chamado in_progress com plano', () => {
    expect(fleetTicketActionPlanLabel('in_progress', true)).toBe('Com plano de ação');
  });

  it('retorna null para chamado closed sem plano', () => {
    expect(fleetTicketActionPlanLabel('closed', false)).toBeNull();
  });

  it.each(['resolved', 'cancelled'] as const)('retorna "Encerrado com plano de ação" para status %s com plano', (status) => {
    expect(fleetTicketActionPlanLabel(status, true)).toBe('Encerrado com plano de ação');
  });
});
