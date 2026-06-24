import { describe, it, expect } from 'vitest';
import { buildMaintenanceFilterOptions, applyMaintenanceListFilters } from './maintenanceFilters';
import type { MaintenanceOrder } from '../types/maintenance';

function makeOrder(overrides: Partial<Pick<MaintenanceOrder, 'shipperName' | 'operationalUnitName'>> = {}): Pick<MaintenanceOrder, 'shipperName' | 'operationalUnitName'> {
  return { shipperName: undefined, operationalUnitName: undefined, ...overrides };
}

describe('buildMaintenanceFilterOptions', () => {
  it('returns distinct sorted lists in pt-BR', () => {
    const orders = [
      makeOrder({ shipperName: 'Embarcador B', operationalUnitName: 'Unidade RJ' }),
      makeOrder({ shipperName: 'Embarcador A', operationalUnitName: 'Unidade SP' }),
      makeOrder({ shipperName: 'Embarcador A', operationalUnitName: 'Unidade RJ' }),
    ];
    const result = buildMaintenanceFilterOptions(orders);
    expect(result.shippers).toEqual(['Embarcador A', 'Embarcador B']);
    expect(result.operationalUnits).toEqual(['Unidade RJ', 'Unidade SP']);
  });

  it('ignores undefined and empty values', () => {
    const orders = [
      makeOrder({ shipperName: undefined, operationalUnitName: '' }),
      makeOrder({ shipperName: '', operationalUnitName: '  ' }),
      makeOrder({ shipperName: 'Embarcador X', operationalUnitName: 'Unidade SP' }),
    ];
    const result = buildMaintenanceFilterOptions(orders);
    expect(result.shippers).toEqual(['Embarcador X']);
    expect(result.operationalUnits).toEqual(['Unidade SP']);
  });

  it('returns empty arrays for empty input', () => {
    const result = buildMaintenanceFilterOptions([]);
    expect(result.shippers).toEqual([]);
    expect(result.operationalUnits).toEqual([]);
  });
});

describe('applyMaintenanceListFilters', () => {
  const orders = [
    { ...makeOrder({ shipperName: 'Embarcador X', operationalUnitName: 'Unidade SP' }), id: '1' },
    { ...makeOrder({ shipperName: 'Embarcador Y', operationalUnitName: 'Unidade RJ' }), id: '2' },
    { ...makeOrder({ shipperName: 'Embarcador X', operationalUnitName: 'Unidade RJ' }), id: '3' },
    { ...makeOrder({ shipperName: undefined, operationalUnitName: 'Unidade SP' }), id: '4' },
  ] as Array<Pick<MaintenanceOrder, 'shipperName' | 'operationalUnitName'> & { id: string }>;

  it('filters by single shipper', () => {
    const result = applyMaintenanceListFilters(orders, { shippers: ['Embarcador X'], operationalUnits: [] });
    expect(result).toHaveLength(2);
    expect(result.map(o => o.id)).toEqual(['1', '3']);
  });

  it('filters by combined shipper AND unit (intersection)', () => {
    const result = applyMaintenanceListFilters(orders, { shippers: ['Embarcador X'], operationalUnits: ['Unidade SP'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('multi-selection within a field (OR)', () => {
    const result = applyMaintenanceListFilters(orders, { shippers: ['Embarcador X', 'Embarcador Y'], operationalUnits: [] });
    expect(result).toHaveLength(3);
    expect(result.map(o => o.id)).toEqual(['1', '2', '3']);
  });

  it('empty filters return all orders', () => {
    const result = applyMaintenanceListFilters(orders, { shippers: [], operationalUnits: [] });
    expect(result).toHaveLength(4);
  });

  it('order with undefined shipperName does not pass when shipper filter is active', () => {
    const result = applyMaintenanceListFilters(orders, { shippers: ['Embarcador X'], operationalUnits: [] });
    expect(result.find(o => o.id === '4')).toBeUndefined();
  });
});
