import { describe, it, expect } from 'vitest';
import { budgetItemFromRow } from './maintenanceMappers';
import type { MaintenanceBudgetItemRow } from '../types/maintenance';

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