import { describe, expect, it } from 'vitest';

import { mapFuelSupplyRow } from './fuelSupplyMappers';

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fs-1',
    client_id: 'c1',
    vehicle_id: 'v1',
    driver_id: 'd1',
    plate: 'ABC1D23',
    driver_name: 'JOSE DA SILVA',
    vehicle_model: 'ONIX',
    fuel_type: 'GASOLINA COMUM',
    amount_liters: '8.940',
    unit_value: '5.5900',
    total_value: '50.00',
    odometer: 28620,
    previous_odometer: 28000,
    km_traveled: '620.00',
    transaction_date: '2023-02-01T07:05:06.000Z',
    transaction_status: 'APROVADA',
    supply_location: 'AUTOPOSTO TESTE LTDA',
    network: 'POSTOS VELOE',
    cost_center: 'OO1',
    base_name: 'VELOE MARKETING',
    card_last4: '3456',
    vehicles: {
      id: 'v1',
      shipper_id: 's1',
      operational_unit_id: 'u1',
      shippers: { id: 's1', name: 'Mercado Livre' },
      operational_units: { id: 'u1', name: 'Base Cajamar' },
    },
    ...overrides,
  };
}

describe('mapFuelSupplyRow', () => {
  it('mapeia uma linha completa achatando os joins', () => {
    const supply = mapFuelSupplyRow(row());

    expect(supply).not.toBeNull();
    expect(supply?.id).toBe('fs-1');
    expect(supply?.plate).toBe('ABC1D23');
    expect(supply?.vehicleId).toBe('v1');
    expect(supply?.shipperId).toBe('s1');
    expect(supply?.shipperName).toBe('Mercado Livre');
    expect(supply?.operationalUnitId).toBe('u1');
    expect(supply?.operationalUnitName).toBe('Base Cajamar');
    expect(supply?.amountLiters).toBe(8.94);
    expect(supply?.unitValue).toBe(5.59);
    expect(supply?.totalValue).toBe(50);
    expect(supply?.kmTraveled).toBe(620);
    expect(supply?.odometer).toBe(28620);
  });

  it('devolve null para entradas inválidas', () => {
    expect(mapFuelSupplyRow(null)).toBeNull();
    expect(mapFuelSupplyRow({})).toBeNull();
    expect(mapFuelSupplyRow({ id: 1 })).toBeNull();
  });

  it('mantém o registro quando o veículo não foi casado', () => {
    const supply = mapFuelSupplyRow(row({ vehicle_id: null, driver_id: null, vehicles: null }));

    expect(supply).not.toBeNull();
    expect(supply?.vehicleId).toBeNull();
    expect(supply?.shipperId).toBeNull();
    expect(supply?.shipperName).toBeNull();
    expect(supply?.operationalUnitId).toBeNull();
    expect(supply?.operationalUnitName).toBeNull();
  });
});
