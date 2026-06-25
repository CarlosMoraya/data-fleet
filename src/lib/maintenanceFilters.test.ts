import { describe, it, expect } from 'vitest';

import { buildMaintenanceFilterOptions, applyMaintenanceListFilters } from './maintenanceFilters';

import type { MaintenanceOrder } from '../types/maintenance';

function makeOrder(
  overrides: Partial<Pick<MaintenanceOrder, 'status' | 'shipperName' | 'operationalUnitName' | 'workshop'>> = {},
): Pick<MaintenanceOrder, 'status' | 'shipperName' | 'operationalUnitName' | 'workshop'> {
  return {
    status: 'Aguardando orçamento',
    shipperName: undefined,
    operationalUnitName: undefined,
    workshop: '',
    ...overrides,
  };
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
    expect(result.workshops).toEqual([]);
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
    expect(result.workshops).toEqual([]);
  });

  it('returns empty arrays for empty input', () => {
    const result = buildMaintenanceFilterOptions([]);
    expect(result.shippers).toEqual([]);
    expect(result.operationalUnits).toEqual([]);
    expect(result.workshops).toEqual([]);
  });

  it('extracts distinct workshops sorted in pt-BR and ignores empty values', () => {
    const orders = [
      makeOrder({ workshop: 'Oficina B' }),
      makeOrder({ workshop: 'Oficina A' }),
      makeOrder({ workshop: 'Oficina A' }),
      makeOrder({ workshop: '' }),
      makeOrder({ workshop: '  ' }),
    ];
    const result = buildMaintenanceFilterOptions(orders);
    expect(result.workshops).toEqual(['Oficina A', 'Oficina B']);
  });
});

describe('applyMaintenanceListFilters', () => {
  const orders = [
    { ...makeOrder({ status: 'Aguardando orçamento', shipperName: 'Embarcador X', operationalUnitName: 'Unidade SP', workshop: 'Oficina A' }), id: '1' },
    { ...makeOrder({ status: 'Concluído', shipperName: 'Embarcador Y', operationalUnitName: 'Unidade RJ', workshop: 'Oficina B' }), id: '2' },
    { ...makeOrder({ status: 'Cancelado', shipperName: 'Embarcador X', operationalUnitName: 'Unidade RJ', workshop: 'Oficina C' }), id: '3' },
    { ...makeOrder({ status: 'Serviço em execução', shipperName: undefined, operationalUnitName: 'Unidade SP', workshop: '' }), id: '4' },
    { ...makeOrder({ status: 'Concluído', shipperName: 'Embarcador X', operationalUnitName: 'Unidade SP', workshop: 'Oficina B' }), id: '5' },
  ] as Array<Pick<MaintenanceOrder, 'status' | 'shipperName' | 'operationalUnitName' | 'workshop'> & { id: string }>;

  it('filters by single shipper', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: ['Embarcador X'], operationalUnits: [], workshops: [] });
    expect(result).toHaveLength(3);
    expect(result.map(o => o.id)).toEqual(['1', '3', '5']);
  });

  it('filters by combined shipper AND unit (intersection)', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: ['Embarcador X'], operationalUnits: ['Unidade SP'], workshops: [] });
    expect(result).toHaveLength(2);
    expect(result.map(o => o.id)).toEqual(['1', '5']);
  });

  it('multi-selection within a field (OR)', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: ['Embarcador X', 'Embarcador Y'], operationalUnits: [], workshops: [] });
    expect(result).toHaveLength(4);
    expect(result.map(o => o.id)).toEqual(['1', '2', '3', '5']);
  });

  it('empty filters return all orders', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: [], operationalUnits: [], workshops: [] });
    expect(result).toHaveLength(5);
  });

  it('order with undefined shipperName does not pass when shipper filter is active', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: ['Embarcador X'], operationalUnits: [], workshops: [] });
    expect(result.find(o => o.id === '4')).toBeUndefined();
  });

  it('filters by single status', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: ['Concluído'], shippers: [], operationalUnits: [], workshops: [] });
    expect(result.map(o => o.id)).toEqual(['2', '5']);
  });

  it('filters by multiple statuses with OR semantics', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: ['Concluído', 'Cancelado'], shippers: [], operationalUnits: [], workshops: [] });
    expect(result.map(o => o.id)).toEqual(['2', '3', '5']);
  });

  it('filters by single workshop', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: [], operationalUnits: [], workshops: ['Oficina B'] });
    expect(result.map(o => o.id)).toEqual(['2', '5']);
  });

  it('filters by multiple workshops with OR semantics', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: [], operationalUnits: [], workshops: ['Oficina A', 'Oficina C'] });
    expect(result.map(o => o.id)).toEqual(['1', '3']);
  });

  it('combines status, shipper, unit and workshop with intersection semantics', () => {
    const result = applyMaintenanceListFilters(orders, {
      statuses: ['Concluído'],
      shippers: ['Embarcador X'],
      operationalUnits: ['Unidade SP'],
      workshops: ['Oficina B'],
    });
    expect(result.map(o => o.id)).toEqual(['5']);
  });

  it('order with empty workshop does not pass when workshop filter is active', () => {
    const result = applyMaintenanceListFilters(orders, { statuses: [], shippers: [], operationalUnits: [], workshops: ['Oficina A'] });
    expect(result.find(o => o.id === '4')).toBeUndefined();
  });
});
