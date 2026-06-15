import { describe, it, expect } from 'vitest';
import { OPERATIONAL_ACTION_ROUTES } from './operationalActionRoutes';

describe('OPERATIONAL_ACTION_ROUTES', () => {
  it('maps every operational action category to the expected route', () => {
    expect(OPERATIONAL_ACTION_ROUTES.checklist).toBe('/checklists');
    expect(OPERATIONAL_ACTION_ROUTES.crlv).toBe('/cadastros/veiculos');
    expect(OPERATIONAL_ACTION_ROUTES.crlv_expiring).toBe('/cadastros/veiculos');
    expect(OPERATIONAL_ACTION_ROUTES.cnh).toBe('/cadastros/motoristas');
    expect(OPERATIONAL_ACTION_ROUTES.cnh_expiring).toBe('/cadastros/motoristas');
    expect(OPERATIONAL_ACTION_ROUTES.os_overdue).toBe('/manutencao');
    expect(OPERATIONAL_ACTION_ROUTES.os_pending_approval).toBe('/aprovacao-orcamentos');
    expect(OPERATIONAL_ACTION_ROUTES.gr_vehicle_expiring).toBe('/cadastros/veiculos');
    expect(OPERATIONAL_ACTION_ROUTES.gr_driver_expiring).toBe('/cadastros/motoristas');
  });

  it('routes os_pending_approval to budget approvals in operational queue', () => {
    expect(OPERATIONAL_ACTION_ROUTES.os_pending_approval).toBe('/aprovacao-orcamentos');
  });
});
