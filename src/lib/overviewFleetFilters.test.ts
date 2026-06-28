import { describe, it, expect } from 'vitest';

import {
  applyOverviewFleetFilter,
  toggleDimensionValue,
  countActiveMaintenanceVehiclesByIds,
  sumApprovedCostByVehicleIds,
  countOverdueChecklistByIds,
  isFiltersEmpty,
  filtersExcept,
  removeDimensionValue,
  clearDimension,
  EMPTY_OVERVIEW_FILTERS,
  type OverviewFleetFilters,
} from './overviewFleetFilters';

import type { VehicleRow } from '../components/dashboard/OperationalPanel';

function makeVehicle(overrides: Partial<VehicleRow> & { id: string }): VehicleRow {
  return {
    id: overrides.id,
    type: overrides.type ?? 'Cavalo',
    crlv_year: overrides.crlv_year ?? null,
    crlv_expiration_date: overrides.crlv_expiration_date ?? null,
    driver_id: overrides.driver_id ?? null,
    category: overrides.category ?? null,
    model: overrides.model ?? null,
    acquisition: overrides.acquisition ?? null,
    shipper_name: overrides.shipper_name ?? null,
    operational_unit_name: overrides.operational_unit_name ?? null,
    license_plate: overrides.license_plate ?? null,
    brand: overrides.brand ?? null,
    has_insurance: overrides.has_insurance ?? null,
    tracker: overrides.tracker ?? null,
  };
}

const vehicles: VehicleRow[] = [
  makeVehicle({ id: '1', type: 'Cavalo', category: 'Pesado', shipper_name: 'ACME', acquisition: 'Owned', model: 'Volvo FH' }),
  makeVehicle({ id: '2', type: 'Truck', category: 'Leve', shipper_name: 'ACME', acquisition: 'Rented', model: 'Iveco Daily' }),
  makeVehicle({ id: '3', type: 'Cavalo', category: 'Pesado', shipper_name: 'Beta', acquisition: 'Agregado', model: 'Scania R' }),
  makeVehicle({ id: '4', type: 'Van', category: 'Leve', shipper_name: null, acquisition: null, model: null }),
];

describe('applyOverviewFleetFilter', () => {
  it('returns all vehicles when filter is empty', () => {
    const result = applyOverviewFleetFilter(vehicles, EMPTY_OVERVIEW_FILTERS);
    expect(result).toHaveLength(4);
  });

  it('filters by single dimension — shipper', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, shipper: ['ACME'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['1', '2']);
  });

  it('OR within dimension — shipper with multiple values', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, shipper: ['ACME', 'Beta'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['1', '2', '3']);
  });

  it('AND between dimensions — shipper + type', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, shipper: ['ACME'], type: ['Cavalo'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['1']);
  });

  it('fallback — vehicle with null shipper matches "Sem Embarcador"', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, shipper: ['Sem Embarcador'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['4']);
  });

  it('fallback — vehicle with null shipper excluded when selection is specific', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, shipper: ['ACME'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).not.toContain('4');
  });

  it('acquisition mapped — "Alugado" matches Rented', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, acquisition: ['Alugado'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it('acquisition mapped — "Próprio" matches Owned', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, acquisition: ['Próprio'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['1']);
  });

  it('acquisition fallback — "Não Informado" matches null acquisition', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, acquisition: ['Não Informado'] };
    const result = applyOverviewFleetFilter(vehicles, filters);
    expect(result.map((v) => v.id)).toEqual(['4']);
  });
});

describe('toggleDimensionValue', () => {
  it('simple click sets [name]', () => {
    const result = toggleDimensionValue(EMPTY_OVERVIEW_FILTERS, 'type', 'Cavalo', false);
    expect(result.type).toEqual(['Cavalo']);
  });

  it('simple click on same value toggles off', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'] };
    const result = toggleDimensionValue(filters, 'type', 'Cavalo', false);
    expect(result.type).toEqual([]);
  });

  it('simple click on different value replaces', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'] };
    const result = toggleDimensionValue(filters, 'type', 'Truck', false);
    expect(result.type).toEqual(['Truck']);
  });

  it('additive adds value', () => {
    const result = toggleDimensionValue(EMPTY_OVERVIEW_FILTERS, 'type', 'Cavalo', true);
    expect(result.type).toEqual(['Cavalo']);
  });

  it('additive removes if already present', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo', 'Truck'] };
    const result = toggleDimensionValue(filters, 'type', 'Cavalo', true);
    expect(result.type).toEqual(['Truck']);
  });

  it('additive does not affect other dimensions', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, shipper: ['ACME'] };
    const result = toggleDimensionValue(filters, 'type', 'Cavalo', true);
    expect(result.shipper).toEqual(['ACME']);
    expect(result.type).toEqual(['Cavalo']);
  });

  it('does not mutate input', () => {
    const original: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'] };
    const snapshot = { ...original, type: [...original.type] };
    toggleDimensionValue(original, 'type', 'Truck', true);
    expect(original).toEqual(snapshot);
  });
});

describe('countActiveMaintenanceVehiclesByIds', () => {
  const orders = [
    { vehicle_id: '1', status: 'Serviço em execução' },
    { vehicle_id: '1', status: 'Aguardando aprovação' },
    { vehicle_id: '2', status: 'Concluído' },
    { vehicle_id: '3', status: 'Cancelado' },
    { vehicle_id: '4', status: 'Veículo retirado' },
    { vehicle_id: '5', status: 'Serviço em execução' },
  ];

  it('counts distinct active vehicle ids within allowed set', () => {
    const allowed = new Set(['1', '2', '3']);
    expect(countActiveMaintenanceVehiclesByIds(orders, allowed)).toBe(1);
  });

  it('ignores Concluído, Cancelado, Veículo retirado', () => {
    const allowed = new Set(['2', '3', '4']);
    expect(countActiveMaintenanceVehiclesByIds(orders, allowed)).toBe(0);
  });

  it('respects allowedVehicleIds — excludes ids not in set', () => {
    const allowed = new Set(['99']);
    expect(countActiveMaintenanceVehiclesByIds(orders, allowed)).toBe(0);
  });

  it('returns 0 for empty orders', () => {
    expect(countActiveMaintenanceVehiclesByIds([], new Set(['1']))).toBe(0);
  });
});

describe('sumApprovedCostByVehicleIds', () => {
  const orders = [
    { vehicle_id: '1', approved_cost: 100 },
    { vehicle_id: '1', approved_cost: 200 },
    { vehicle_id: '2', approved_cost: 50 },
    { vehicle_id: '3', approved_cost: null },
    { vehicle_id: '4', approved_cost: -10 },
  ];

  it('sums approved_cost > 0 for allowed ids', () => {
    const allowed = new Set(['1', '2']);
    expect(sumApprovedCostByVehicleIds(orders, allowed)).toBe(350);
  });

  it('excludes null and negative costs', () => {
    const allowed = new Set(['3', '4']);
    expect(sumApprovedCostByVehicleIds(orders, allowed)).toBe(0);
  });

  it('returns 0 for empty allowed set', () => {
    expect(sumApprovedCostByVehicleIds(orders, new Set())).toBe(0);
  });
});

describe('countOverdueChecklistByIds', () => {
  it('returns intersection size', () => {
    const overdue = new Set(['1', '2', '3']);
    const allowed = new Set(['2', '3', '4']);
    expect(countOverdueChecklistByIds(overdue, allowed)).toBe(2);
  });

  it('returns 0 when no overlap', () => {
    expect(countOverdueChecklistByIds(new Set(['1']), new Set(['2']))).toBe(0);
  });
});

describe('isFiltersEmpty', () => {
  it('returns true for empty filters', () => {
    expect(isFiltersEmpty(EMPTY_OVERVIEW_FILTERS)).toBe(true);
  });

  it('returns false when any dimension has values', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'] };
    expect(isFiltersEmpty(filters)).toBe(false);
  });
});

describe('filtersExcept', () => {
  it('returns copy with specified key zeroed', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'], shipper: ['ACME'] };
    const result = filtersExcept(filters, 'type');
    expect(result.type).toEqual([]);
    expect(result.shipper).toEqual(['ACME']);
  });

  it('does not mutate input', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'] };
    filtersExcept(filters, 'type');
    expect(filters.type).toEqual(['Cavalo']);
  });
});

describe('removeDimensionValue', () => {
  it('removes specific value', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo', 'Truck'] };
    const result = removeDimensionValue(filters, 'type', 'Cavalo');
    expect(result.type).toEqual(['Truck']);
  });

  it('does not mutate input', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo', 'Truck'] };
    const snapshot = [...filters.type];
    removeDimensionValue(filters, 'type', 'Cavalo');
    expect(filters.type).toEqual(snapshot);
  });
});

describe('clearDimension', () => {
  it('clears specified dimension', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo', 'Truck'] };
    const result = clearDimension(filters, 'type');
    expect(result.type).toEqual([]);
  });

  it('does not mutate input', () => {
    const filters: OverviewFleetFilters = { ...EMPTY_OVERVIEW_FILTERS, type: ['Cavalo'] };
    clearDimension(filters, 'type');
    expect(filters.type).toEqual(['Cavalo']);
  });
});
