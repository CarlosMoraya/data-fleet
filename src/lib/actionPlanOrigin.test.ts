import { describe, expect, it } from 'vitest';

import { actionPlanOriginColor, actionPlanOriginLabel, actionPlanOriginOf } from './actionPlanOrigin';

describe('actionPlanOriginOf', () => {
  it('retorna fleet_ticket quando fleetTicketId está preenchido', () => {
    expect(actionPlanOriginOf({ fleetTicketId: 'uuid-x' })).toBe('fleet_ticket');
  });

  it('retorna checklist quando fleetTicketId é undefined', () => {
    expect(actionPlanOriginOf({ fleetTicketId: undefined })).toBe('checklist');
  });

  it('retorna checklist quando fleetTicketId é string vazia', () => {
    expect(actionPlanOriginOf({ fleetTicketId: '' })).toBe('checklist');
  });

  it('não lança para nenhuma das entradas', () => {
    expect(() => actionPlanOriginOf({ fleetTicketId: 'uuid-x' })).not.toThrow();
    expect(() => actionPlanOriginOf({ fleetTicketId: undefined })).not.toThrow();
    expect(() => actionPlanOriginOf({ fleetTicketId: '' })).not.toThrow();
  });
});

describe('actionPlanOriginLabel', () => {
  it('mapeia fleet_ticket para Chamado', () => {
    expect(actionPlanOriginLabel('fleet_ticket')).toBe('Chamado');
  });

  it('mapeia checklist para Checklist', () => {
    expect(actionPlanOriginLabel('checklist')).toBe('Checklist');
  });
});

describe('actionPlanOriginColor', () => {
  it('não lança para fleet_ticket e checklist', () => {
    expect(() => actionPlanOriginColor('fleet_ticket')).not.toThrow();
    expect(() => actionPlanOriginColor('checklist')).not.toThrow();
  });
});
