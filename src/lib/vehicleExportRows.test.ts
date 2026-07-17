import { describe, expect, it } from 'vitest';

import { buildVehicleExportCells, VEHICLE_EXPORT_HEADERS, type VehicleExportRow } from './vehicleExportRows';

import type { Vehicle } from '../types/vehicle';

function baseVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    clientId: 'c1',
    active: true,
    type: 'Truck',
    energySource: 'Combustão',
    coolingEquipment: false,
    licensePlate: 'ABC1D23',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    detranUF: 'SP',
    brand: 'Volvo',
    model: 'FH 540',
    year: 2022,
    color: 'Branco',
    acquisition: 'Owned',
    fipePrice: 500000,
    tracker: 'Sim',
    antt: '123456',
    owner: 'Frota Própria',
    autonomy: 800,
    category: 'Pesado',
    driverName: 'João da Silva',
    shipperName: 'Embarcador X',
    operationalUnitName: 'Unidade SP',
    vehicleUsage: 'Operação',
    ...overrides,
  };
}

describe('vehicleExportRows', () => {
  it('has exactly 17 headers in the exact order', () => {
    expect(VEHICLE_EXPORT_HEADERS.length).toBe(17);
    expect(VEHICLE_EXPORT_HEADERS).toEqual([
      'Placa',
      'Marca',
      'Modelo',
      'Ano',
      'Tipo',
      'Categoria',
      'Energia',
      'Proprietário',
      'Aquisição',
      'Motorista',
      'Embarcador',
      'Unidade Operacional',
      'Finalidade',
      'Renavam',
      'Chassi',
      'Status',
      'Disponibilidade',
    ]);
  });

  it('maps a complete vehicle with unavailable=false to all correct cells', () => {
    const row: VehicleExportRow = { ...baseVehicle(), unavailable: false };
    const cells = buildVehicleExportCells(row);
    expect(cells).toEqual([
      'ABC1D23',
      'Volvo',
      'FH 540',
      '2022',
      'Truck',
      'Pesado',
      'Combustão',
      'Frota Própria',
      'Próprio',
      'João da Silva',
      'Embarcador X',
      'Unidade SP',
      'Operação',
      '12345678901',
      '9BWZZZ377VT004251',
      'Ativo',
      'Disponível',
    ]);
  });

  it('maps unavailable=true to Disponibilidade=Indisponível', () => {
    const row: VehicleExportRow = { ...baseVehicle(), unavailable: true };
    const cells = buildVehicleExportCells(row);
    expect(cells[16]).toBe('Indisponível');
  });

  it('maps active=false to Status=Inativo', () => {
    const row: VehicleExportRow = { ...baseVehicle({ active: false }), unavailable: false };
    const cells = buildVehicleExportCells(row);
    expect(cells[15]).toBe('Inativo');
  });

  it('renders empty strings for absent optional fields', () => {
    const row: VehicleExportRow = {
      ...baseVehicle({
        driverName: undefined,
        shipperName: undefined,
        operationalUnitName: undefined,
        vehicleUsage: undefined,
        category: undefined,
      }),
      unavailable: false,
    };
    const cells = buildVehicleExportCells(row);
    expect(cells[5]).toBe(''); // Categoria
    expect(cells[9]).toBe(''); // Motorista
    expect(cells[10]).toBe(''); // Embarcador
    expect(cells[11]).toBe(''); // Unidade Operacional
    expect(cells[12]).toBe(''); // Finalidade
  });

  it('translates acquisition values', () => {
    expect(buildVehicleExportCells({ ...baseVehicle({ acquisition: 'Owned' }), unavailable: false })[8]).toBe('Próprio');
    expect(buildVehicleExportCells({ ...baseVehicle({ acquisition: 'Rented' }), unavailable: false })[8]).toBe('Alugado');
    expect(buildVehicleExportCells({ ...baseVehicle({ acquisition: 'Agregado' }), unavailable: false })[8]).toBe('Agregado');
  });
});
