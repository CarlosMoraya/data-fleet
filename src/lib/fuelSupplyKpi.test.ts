import { describe, expect, it } from 'vitest';

import { calculateFuelSupplyKpis } from './fuelSupplyKpi';

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

describe('calculateFuelSupplyKpis', () => {
  it('soma valores, litros e contagem de três abastecimentos', () => {
    const kpis = calculateFuelSupplyKpis([
      supply({ totalValue: 50, amountLiters: 10 }),
      supply({ id: 'fs-2', totalValue: 100, amountLiters: 20 }),
      supply({ id: 'fs-3', totalValue: 150, amountLiters: 30 }),
    ]);

    expect(kpis.totalValue).toBe(300);
    expect(kpis.totalLiters).toBe(60);
    expect(kpis.averagePricePerLiter).toBe(5);
    expect(kpis.supplyCount).toBe(3);
  });

  it('lista vazia devolve zeros e nulos, nunca NaN nem Infinity', () => {
    const kpis = calculateFuelSupplyKpis([]);

    expect(kpis).toEqual({
      totalValue: 0,
      totalLiters: 0,
      averagePricePerLiter: null,
      averageKmPerLiter: null,
      supplyCount: 0,
    });
  });

  it('devolve preço médio nulo quando não há litros', () => {
    const kpis = calculateFuelSupplyKpis([
      supply({ amountLiters: null }),
      supply({ id: 'fs-2', amountLiters: null }),
    ]);

    expect(kpis.totalLiters).toBe(0);
    expect(kpis.averagePricePerLiter).toBeNull();
  });

  it('calcula km/L somente com as linhas que têm km e litros válidos', () => {
    const kpis = calculateFuelSupplyKpis([
      supply({ kmTraveled: 100, amountLiters: 10 }),
      supply({ id: 'fs-2', kmTraveled: null, amountLiters: 40 }),
      supply({ id: 'fs-3', kmTraveled: 0, amountLiters: 25 }),
    ]);

    expect(kpis.averageKmPerLiter).toBe(10);
  });
});
