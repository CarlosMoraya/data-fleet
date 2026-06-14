import { vehicleToRow, vehicleFromRow, type VehicleRow } from './vehicleMappers';
import type { AxleConfigEntry } from '../types';
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

  it('mantem axle_config valido como array', () => {
    const axleConfig: AxleConfigEntry[] = [
      { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
      { order: 2, type: 'duplo', rodagem: 'dupla', physicalAxles: 2 },
    ];

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
      axle_config: axleConfig,
    } as unknown as VehicleRow;

    const vehicle = vehicleFromRow(row);
    expect(vehicle.axleConfig).toEqual(axleConfig);
  });

  it('ignora axle_config invalido para evitar quebra no formulario', () => {
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
      axle_config: { legacy: true },
    } as unknown as VehicleRow;

    const vehicle = vehicleFromRow(row);
    expect(vehicle.axleConfig).toBeUndefined();
  });
});

describe('round-trip de crlv_expiration_date', () => {
  it('vehicleFromRow lê crlv_expiration_date e vehicleToRow grava crlv_expiration_date', () => {
    const row = {
      id: 'v1',
      license_plate: 'ABC1D23',
      crlv_expiration_date: '2027-02-15',
    } as unknown as VehicleRow;

    const vehicle = vehicleFromRow(row);
    expect(vehicle.crlvExpirationDate).toBe('2027-02-15');

    const backToRow = vehicleToRow({ crlvExpirationDate: '2027-02-15' } as Partial<Vehicle>, 'c1');
    expect(backToRow.crlv_expiration_date).toBe('2027-02-15');
  });

  it('null no row vira undefined no Vehicle, e ausência no Vehicle vira null no row', () => {
    const row = {
      id: 'v1',
      license_plate: 'ABC1D23',
      crlv_expiration_date: null,
    } as unknown as VehicleRow;

    const vehicle = vehicleFromRow(row);
    expect(vehicle.crlvExpirationDate).toBeUndefined();

    const backToRow = vehicleToRow({}, 'c1');
    expect(backToRow.crlv_expiration_date).toBeNull();
  });
});
