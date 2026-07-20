import { describe, expect, it } from 'vitest';

import {
  COMPLIANCE_ACTION_ROUTES,
  GENERAL_ACTION_ROUTES,
  OPERATIONAL_ACTION_ROUTES,
  OPERATIONAL_QUEUE_ROUTES,
  VEHICLE_PENDENCY_ACTION_ROUTES,
} from './actionQueueRoutes';
import { DRIVER_PENDENCY_VALUES } from './driverFilters';
import { PENDENCY_VALUES } from './vehicleFilters';

describe('actionQueueRoutes', () => {
  it('maps general vehicle categories to filtered vehicle routes', () => {
    expect(GENERAL_ACTION_ROUTES.checklist).toBe('/cadastros/veiculos?issue=checklist_overdue');
    expect(GENERAL_ACTION_ROUTES.crlv).toBe('/cadastros/veiculos?issue=crlv_expired');
    expect(GENERAL_ACTION_ROUTES.crlv_expiring).toBe('/cadastros/veiculos?issue=crlv_expiring');
    expect(GENERAL_ACTION_ROUTES.gr_vehicle_expiring).toBe('/cadastros/veiculos?issue=gr_expiring');
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
    expect(GENERAL_ACTION_ROUTES.cnh).toBe('/cadastros/motoristas?issue=cnh_expired');
    expect(GENERAL_ACTION_ROUTES.cnh_expiring).toBe('/cadastros/motoristas?issue=cnh_expiring');
    expect(GENERAL_ACTION_ROUTES.gr_driver_expiring).toBe('/cadastros/motoristas?issue=gr_expiring');
    expect(OPERATIONAL_ACTION_ROUTES.cnh).toBe('/cadastros/motoristas?issue=cnh_expired');
    expect(OPERATIONAL_ACTION_ROUTES.cnh_expiring).toBe('/cadastros/motoristas?issue=cnh_expiring');
    expect(OPERATIONAL_ACTION_ROUTES.gr_driver_expiring).toBe('/cadastros/motoristas?issue=gr_expiring');
  });

  it('uses only valid pendency values in vehicle routes', () => {
    for (const route of Object.values(VEHICLE_PENDENCY_ACTION_ROUTES)) {
      const pendency = new URL(`https://betafleet.local${route}`).searchParams.get('issue');
      expect(PENDENCY_VALUES).toContain(pendency);
    }
  });

  it('uses only valid driver issue values in driver routes', () => {
    const driverKeys = ['cnh', 'cnh_expiring', 'gr_driver_expiring'] as const;
    for (const map of [GENERAL_ACTION_ROUTES, OPERATIONAL_ACTION_ROUTES]) {
      for (const key of driverKeys) {
        const issue = new URL(`https://betafleet.local${map[key]}`).searchParams.get('issue');
        expect(DRIVER_PENDENCY_VALUES).toContain(issue);
      }
    }
  });

  it('COMPLIANCE_ACTION_ROUTES cobre todas as 15 categorias', () => {
    expect(Object.keys(COMPLIANCE_ACTION_ROUTES)).toEqual([
      'crlv_expired',
      'cnh_expired',
      'gr_vehicle_expired',
      'gr_driver_expired',
      'crlv_expiring',
      'cnh_expiring',
      'gr_vehicle_expiring',
      'gr_driver_expiring',
      'crlv_missing',
      'cnh_missing',
      'gr_vehicle_missing',
      'gr_driver_missing',
      'insurance_missing',
      'maintenance_contract_missing',
      'pj_contract_missing',
    ]);
  });

  it('rotas de motorista usam apenas valores válidos de issue de motorista e de veículo apenas valores válidos de veículo', () => {
    const driverCategories = ['cnh_expired', 'cnh_expiring', 'gr_driver_expired', 'gr_driver_expiring', 'cnh_missing', 'gr_driver_missing', 'pj_contract_missing'] as const;
    const vehicleCategories = ['crlv_expired', 'gr_vehicle_expired', 'crlv_expiring', 'gr_vehicle_expiring', 'crlv_missing', 'gr_vehicle_missing', 'insurance_missing', 'maintenance_contract_missing'] as const;

    for (const category of driverCategories) {
      const issue = new URL(`https://betafleet.local${COMPLIANCE_ACTION_ROUTES[category]}`).searchParams.get('issue');
      expect(DRIVER_PENDENCY_VALUES).toContain(issue);
    }

    for (const category of vehicleCategories) {
      const issue = new URL(`https://betafleet.local${COMPLIANCE_ACTION_ROUTES[category]}`).searchParams.get('issue');
      expect(PENDENCY_VALUES).toContain(issue);
    }
  });

  it('covers all operational queue categories', () => {
    expect(Object.keys(OPERATIONAL_QUEUE_ROUTES)).toEqual([
      'vehicles_unavailable',
      'vehicles_no_driver',
      'os_open',
      'os_overdue',
      'os_exit_this_week',
      'os_pending_approval',
      'checklist_overdue',
      'action_plans_open',
      'os_pending_budget',
      'os_due_soon',
    ]);
  });

  it('maps the required operational queue deep links and routes', () => {
    expect(OPERATIONAL_QUEUE_ROUTES.vehicles_no_driver).toBe('/cadastros/veiculos?issue=no_driver');
    expect(OPERATIONAL_QUEUE_ROUTES.checklist_overdue).toBe('/cadastros/veiculos?issue=checklist_overdue');
    expect(OPERATIONAL_QUEUE_ROUTES.os_pending_approval).toBe('/aprovacao-orcamentos');
  });

  it('uses absolute app routes in the operational queue', () => {
    for (const route of Object.values(OPERATIONAL_QUEUE_ROUTES)) {
      expect(route.startsWith('/')).toBe(true);
    }
  });
});
