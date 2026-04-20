import { vehicleToRow, vehicleFromRow, type VehicleRow } from './vehicleMappers';
import type { Vehicle } from '../types/vehicle';

describe('vehicleToRow', () => {
  it('converte camelCase → snake_case', () => {
    const vehicle: Partial<Vehicle> = {
      id: 'v1',
      licensePlate: 'ABC1D23',
      brand: 'FIAT',
      model: 'STRADA',
      year: 2024,
      type: 'Utilitário',
      energySource: 'Combustão',
      coolingEquipment: false,
      acquisition: 'Owned',
      fipePrice: 120000,
      owner: 'Empresa X',
    };

    const row = vehicleToRow(vehicle, 'client-1');
    expect(row.license_plate).toBe('ABC1D23');
    expect(row.brand).toBe('FIAT');
    expect(row.model).toBe('STRADA');
    expect(row.year).toBe(2024);
    expect(row.client_id).toBe('client-1');
  });

  it('handle undefined/null como null no row', () => {
    const row = vehicleToRow({ pbt: undefined, cmt: null, eixos: 2 }, 'c1');
    expect(row.pbt).toBeNull();
    expect(row.cmt).toBeNull();
    expect(row.eixos).toBe(2);
  });
});

describe('vehicleFromRow', () => {
  it('converte snake_case → camelCase', () => {
    const row: Partial<VehicleRow> = {
      id: 'v1',
      license_plate: 'ABC1D23',
      brand: 'FIAT',
      model: 'STRADA',
      year: 2024,
      type: 'Utilitário',
      energy_source: 'Combustão',
      cooling_equipment: false,
      acquisition: 'Owned',
      fipe_price: 120000,
      owner: 'Empresa X',
    };

    const vehicle = vehicleFromRow(row as VehicleRow);
    expect(vehicle.licensePlate).toBe('ABC1D23');
    expect(vehicle.brand).toBe('FIAT');
    expect(vehicle.year).toBe(2024);
    expect(vehicle.coolingEquipment).toBe(false);
  });

  it('handle joins (driverName, shipperName)', () => {
    const row = {
      id: 'v1',
      license_plate: 'ABC1D23',
      brand: 'FIAT',
      model: 'STRADA',
      year: 2024,
      type: 'Utilitário',
      energy_source: 'Combustão',
      cooling_equipment: false,
      acquisition: 'Owned',
      fipe_price: 0,
      owner: '',
      drivers: { name: 'João Silva' },
      shippers: { name: 'Embarcador X' },
    } as unknown as VehicleRow;

    const vehicle = vehicleFromRow(row);
    expect(vehicle.driverName).toBe('João Silva');
    expect(vehicle.shipperName).toBe('Embarcador X');
  });
});
