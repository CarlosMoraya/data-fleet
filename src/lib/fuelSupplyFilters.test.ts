import { describe, expect, it } from 'vitest';

import {
  applyFuelSupplyFilters,
  countUnmatchedSupplies,
  EMPTY_FUEL_SUPPLY_FILTERS,
  parseFuelSupplyFiltersFromParams,
  writeFuelSupplyFiltersToParams,
} from './fuelSupplyFilters';

import type { FuelSupply } from '../types/fuelSupply';

function supply(overrides: Partial<FuelSupply> = {}): FuelSupply {
  return {
    id: 'fs-1',
    clientId: 'c1',
    vehicleId: 'v1',
    driverId: null,
    plate: 'ABC1D23',
    driverName: null,
    vehicleModel: null,
    fuelType: null,
    amountLiters: 10,
    unitValue: 5,
    totalValue: 50,
    odometer: null,
    previousOdometer: null,
    kmTraveled: null,
    transactionDate: '2026-09-01T12:00:00.000Z',
    transactionStatus: null,
    supplyLocation: null,
    network: null,
    costCenter: null,
    baseName: null,
    cardLast4: null,
    shipperId: 's1',
    shipperName: 'Embarcador 1',
    operationalUnitId: 'u1',
    operationalUnitName: 'Unidade 1',
    ...overrides,
  };
}

const list: FuelSupply[] = [
  supply({ id: 'a', shipperId: 's1', operationalUnitId: 'u1', plate: 'ABC1D23' }),
  supply({ id: 'b', shipperId: 's2', operationalUnitId: 'u2', plate: 'XYZ9K88' }),
  supply({ id: 'c', shipperId: 's3', operationalUnitId: 'u3', plate: 'ABC7T11' }),
  supply({
    id: 'sem-veiculo',
    vehicleId: null,
    shipperId: null,
    shipperName: null,
    operationalUnitId: null,
    operationalUnitName: null,
    plate: 'QRS4M02',
  }),
];

describe('applyFuelSupplyFilters', () => {
  it('dois embarcadores selecionados devolvem a união dos dois', () => {
    const result = applyFuelSupplyFilters(list, {
      ...EMPTY_FUEL_SUPPLY_FILTERS,
      shipperIds: ['s1', 's2'],
    });

    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('embarcador e placa juntos devolvem a interseção', () => {
    const result = applyFuelSupplyFilters(list, {
      ...EMPTY_FUEL_SUPPLY_FILTERS,
      shipperIds: ['s1', 's3'],
      plateQuery: 'ABC1',
    });

    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('registro sem veículo aparece sem filtros e some com filtro de embarcador', () => {
    expect(applyFuelSupplyFilters(list, EMPTY_FUEL_SUPPLY_FILTERS)).toHaveLength(4);

    const filtered = applyFuelSupplyFilters(list, {
      ...EMPTY_FUEL_SUPPLY_FILTERS,
      shipperIds: ['s1'],
    });
    expect(filtered.map((item) => item.id)).not.toContain('sem-veiculo');
  });

  it('busca de placa é parcial e case-insensitive', () => {
    const result = applyFuelSupplyFilters(list, {
      ...EMPTY_FUEL_SUPPLY_FILTERS,
      plateQuery: 'abc',
    });

    expect(result.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('filtra por unidade operacional', () => {
    const result = applyFuelSupplyFilters(list, {
      ...EMPTY_FUEL_SUPPLY_FILTERS,
      unitIds: ['u2'],
    });

    expect(result.map((item) => item.id)).toEqual(['b']);
  });
});

describe('parseFuelSupplyFiltersFromParams / writeFuelSupplyFiltersToParams', () => {
  it('faz ida e volta sem perder valores', () => {
    const filters = { shipperIds: ['s1', 's2'], unitIds: ['u1'], plateQuery: 'ABC1D23' };
    const params = writeFuelSupplyFiltersToParams(filters);

    expect(parseFuelSupplyFiltersFromParams(params)).toEqual(filters);
  });

  it('omite q quando a busca de placa está vazia', () => {
    const params = writeFuelSupplyFiltersToParams(EMPTY_FUEL_SUPPLY_FILTERS);

    expect(params.has('q')).toBe(false);
    expect(parseFuelSupplyFiltersFromParams(params)).toEqual(EMPTY_FUEL_SUPPLY_FILTERS);
  });
});

describe('countUnmatchedSupplies', () => {
  it('conta os registros sem veículo casado', () => {
    expect(countUnmatchedSupplies(list)).toBe(1);
    expect(countUnmatchedSupplies([])).toBe(0);
  });
});
