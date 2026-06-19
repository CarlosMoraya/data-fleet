import { describe, expect, it } from 'vitest';
import { PENDENCY_VALUES } from './vehicleFilters';
import {
  GENERAL_ACTION_ROUTES,
  OPERATIONAL_ACTION_ROUTES,
  VEHICLE_PENDENCY_ACTION_ROUTES,
} from './actionQueueRoutes';

describe('actionQueueRoutes', () => {
  it('maps general vehicle categories to filtered vehicle routes', () => {
    expect(GENERAL_ACTION_ROUTES.checklist).toBe('/cadastros/veiculos?pendencia=checklist_vencido');
    expect(GENERAL_ACTION_ROUTES.crlv).toBe('/cadastros/veiculos?pendencia=crlv_vencido');
    expect(GENERAL_ACTION_ROUTES.crlv_expiring).toBe('/cadastros/veiculos?pendencia=crlv_a_vencer');
    expect(GENERAL_ACTION_ROUTES.gr_vehicle_expiring).toBe('/cadastros/veiculos?pendencia=gr_a_vencer');
  });

  it('reuses the same vehicle routes in the operational queue', () => {
    expect(OPERATIONAL_ACTION_ROUTES.checklist).toBe(VEHICLE_PENDENCY_ACTION_ROUTES.checklist);
    expect(OPERATIONAL_ACTION_ROUTES.crlv).toBe(VEHICLE_PENDENCY_ACTION_ROUTES.crlv);
    expect(OPERATIONAL_ACTION_ROUTES.crlv_expiring).toBe(VEHICLE_PENDENCY_ACTION_ROUTES.crlv_expiring);
    expect(OPERATIONAL_ACTION_ROUTES.gr_vehicle_expiring).toBe(VEHICLE_PENDENCY_ACTION_ROUTES.gr_vehicle_expiring);
  });

  it('preserves intentional non-vehicle destinations', () => {
    expect(OPERATIONAL_ACTION_ROUTES.os_pending_approval).toBe('/aprovacao-orcamentos');
    expect(GENERAL_ACTION_ROUTES.os_pending_approval).toBe('/manutencao');
    expect(GENERAL_ACTION_ROUTES.cnh).toBe('/cadastros/motoristas');
    expect(GENERAL_ACTION_ROUTES.cnh_expiring).toBe('/cadastros/motoristas');
    expect(GENERAL_ACTION_ROUTES.gr_driver_expiring).toBe('/cadastros/motoristas');
    expect(OPERATIONAL_ACTION_ROUTES.cnh).toBe('/cadastros/motoristas');
    expect(OPERATIONAL_ACTION_ROUTES.cnh_expiring).toBe('/cadastros/motoristas');
    expect(OPERATIONAL_ACTION_ROUTES.gr_driver_expiring).toBe('/cadastros/motoristas');
  });

  it('uses only valid pendency values in vehicle routes', () => {
    for (const route of Object.values(VEHICLE_PENDENCY_ACTION_ROUTES)) {
      const pendency = new URL(`https://betafleet.local${route}`).searchParams.get('pendencia');
      expect(PENDENCY_VALUES).toContain(pendency);
    }
  });
});
