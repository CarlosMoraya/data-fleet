import { describe, it, expect } from 'vitest';

import { budgetItemFromRow, maintenanceFromRow } from './maintenanceMappers';

import type { MaintenanceBudgetItemRow, MaintenanceOrderRow } from '../types/maintenance';

/** Helper to build a minimal row with sensible defaults. */
function makeRow(overrides: Partial<MaintenanceBudgetItemRow> = {}): MaintenanceBudgetItemRow {
  return {
    id: 'row-1',
    maintenance_order_id: 'mo-1',
    client_id: 'client-1',
    item_name: 'Pastilha de freio',
    system: 'Sistema de Freio',
    quantity: 2,
    value: 180,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('budgetItemFromRow', () => {
  it('normalizes null system to Outros', () => {
    const item = budgetItemFromRow(makeRow({ system: null }));
    expect(item.system).toBe('Outros');
  });

  it('preserves known system', () => {
    const item = budgetItemFromRow(makeRow({ system: 'Motor' }));
    expect(item.system).toBe('Motor');
  });

  it('normalizes unknown legacy system to Outros', () => {
    const item = budgetItemFromRow(makeRow({ system: 'Sistema Inventado' }));
    expect(item.system).toBe('Outros');
  });

  it('normalizes empty string system to Outros', () => {
    const item = budgetItemFromRow(makeRow({ system: '' }));
    expect(item.system).toBe('Outros');
  });

  it('maps other fields correctly', () => {
    const item = budgetItemFromRow(makeRow());
    expect(item.itemName).toBe('Pastilha de freio');
    expect(item.quantity).toBe(2);
    expect(item.value).toBe(180);
  });
});

function makeMaintenanceRow(overrides: Partial<MaintenanceOrderRow> = {}): MaintenanceOrderRow {
  return {
    id: 'mo-1',
    client_id: 'client-1',
    vehicle_id: 'v-1',
    workshop_id: 'w-1',
    os_number: 'OS-001',
    entry_date: '2026-01-01T00:00:00Z',
    expected_exit_date: '2026-01-10T00:00:00Z',
    actual_exit_date: null,
    type: 'Corretiva',
    status: 'Aguardando orçamento',
    description: 'Test description',
    mechanic_name: 'Mechanic A',
    estimated_cost: 1000,
    approved_cost: null,
    created_by_id: 'user-1',
    notes: null,
    workshop_os_number: null,
    current_km: null,
    budget_pdf_url: null,
    budget_status: null,
    budget_reviewed_by: null,
    budget_reviewed_at: null,
    budget_rejection_reason: null,
    cancelled_at: null,
    cancelled_by_id: null,
    warranty_revision_event_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    vehicles: { license_plate: 'ABC-1234' },
    workshops: { name: 'Workshop A' },
    profiles: { name: 'User A' },
    ...overrides,
  };
}

describe('maintenanceFromRow — budgetRejectionReason', () => {
  it('maps budget_rejection_reason to budgetRejectionReason', () => {
    const row = makeMaintenanceRow({ budget_rejection_reason: 'Valor acima do orçado' });
    expect(maintenanceFromRow(row).budgetRejectionReason).toBe('Valor acima do orçado');
  });

  it('maps null to undefined', () => {
    const row = makeMaintenanceRow({ budget_rejection_reason: null });
    expect(maintenanceFromRow(row).budgetRejectionReason).toBeUndefined();
  });
});

describe('maintenanceFromRow — actualExitDate', () => {
  it('maps actualExitDate from row', () => {
    // null → undefined
    const nullRow = makeMaintenanceRow({ actual_exit_date: null });
    expect(maintenanceFromRow(nullRow).actualExitDate).toBeUndefined();

    // ISO string → preserved
    const iso = '2026-06-24T10:00:00Z';
    const isoRow = makeMaintenanceRow({ actual_exit_date: iso });
    expect(maintenanceFromRow(isoRow).actualExitDate).toBe(iso);
  });
});

describe('maintenanceFromRow — shipperName / operationalUnitName', () => {
  it('maps shipperName and operationalUnitName when present', () => {
    const row = makeMaintenanceRow({
      vehicles: {
        license_plate: 'ABC-1234',
        shippers: { name: 'Embarcador X' },
        operational_units: { name: 'Unidade SP' },
      },
    });
    const order = maintenanceFromRow(row);
    expect(order.shipperName).toBe('Embarcador X');
    expect(order.operationalUnitName).toBe('Unidade SP');
  });

  it('returns undefined when shippers and operational_units are null', () => {
    const row = makeMaintenanceRow({
      vehicles: {
        license_plate: 'ABC-1234',
        shippers: null,
        operational_units: null,
      },
    });
    const order = maintenanceFromRow(row);
    expect(order.shipperName).toBeUndefined();
    expect(order.operationalUnitName).toBeUndefined();
  });

  it('returns undefined when vehicles is missing', () => {
    const row = makeMaintenanceRow({ vehicles: undefined });
    const order = maintenanceFromRow(row);
    expect(order.shipperName).toBeUndefined();
    expect(order.operationalUnitName).toBeUndefined();
  });
});

describe('maintenanceFromRow — vehicleModel', () => {
  it('mounts vehicleModel from model', () => {
    const row = makeMaintenanceRow({
      vehicles: { license_plate: 'ABC-1234', model: 'FH 540' },
    });
    expect(maintenanceFromRow(row).vehicleModel).toBe('FH 540');
  });

  it('trims whitespace around model', () => {
    const row = makeMaintenanceRow({
      vehicles: { license_plate: 'ABC-1234', model: '  ACTROS  ' },
    });
    expect(maintenanceFromRow(row).vehicleModel).toBe('ACTROS');
  });

  it('returns undefined when model is null', () => {
    const row = makeMaintenanceRow({
      vehicles: { license_plate: 'ABC-1234', model: null },
    });
    expect(maintenanceFromRow(row).vehicleModel).toBeUndefined();
  });

  it('returns undefined when model is empty/whitespace', () => {
    const row = makeMaintenanceRow({
      vehicles: { license_plate: 'ABC-1234', model: '   ' },
    });
    expect(maintenanceFromRow(row).vehicleModel).toBeUndefined();
  });

  it('returns undefined when vehicles is missing', () => {
    const row = makeMaintenanceRow({ vehicles: undefined });
    expect(maintenanceFromRow(row).vehicleModel).toBeUndefined();
  });
});