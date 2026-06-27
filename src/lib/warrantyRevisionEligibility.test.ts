import { describe, it, expect } from 'vitest';

import { filterEligibleVehicles, type EligibilityCriteria } from './warrantyRevisionEligibility';

import type { Vehicle } from '../types';

function makeVehicle(over: Partial<Vehicle> & { id: string }): Vehicle {
  return {
    id: over.id,
    clientId: over.clientId ?? 'cli-1',
    type: over.type ?? 'Passeio',
    energySource: over.energySource ?? 'Combustão',
    coolingEquipment: over.coolingEquipment ?? false,
    licensePlate: over.licensePlate ?? 'ABC1D23',
    renavam: over.renavam ?? '123',
    chassi: over.chassi ?? 'CHS',
    detranUF: over.detranUF ?? 'SP',
    brand: over.brand ?? 'Fiat',
    model: over.model ?? 'Mobi',
    year: over.year ?? 2024,
    color: over.color ?? 'Branco',
    acquisition: over.acquisition ?? 'Owned',
    fipePrice: over.fipePrice ?? 0,
    tracker: over.tracker ?? '',
    antt: over.antt ?? '',
    owner: over.owner ?? '',
    autonomy: over.autonomy ?? 0,
    warranty: over.warranty,
    category: over.category,
    operationalUnitId: over.operationalUnitId,
    acquisitionDate: over.acquisitionDate,
  };
}

const _base: Vehicle = makeVehicle({ id: 'v1' });

describe('filterEligibleVehicles', () => {
  it('filtra por marca', () => {
    const list = [
      makeVehicle({ id: 'a', brand: 'Fiat' }),
      makeVehicle({ id: 'b', brand: 'VW' }),
    ];
    const criteria: EligibilityCriteria = { brand: 'Fiat' };
    expect(filterEligibleVehicles(list, criteria, new Set(), new Map()).map(v => v.id)).toEqual(['a']);
  });

  it('filtra por modelo', () => {
    const list = [
      makeVehicle({ id: 'a', model: 'Mobi' }),
      makeVehicle({ id: 'b', model: 'Polo' }),
    ];
    expect(filterEligibleVehicles(list, { model: 'Polo' }, new Set(), new Map()).map(v => v.id)).toEqual(['b']);
  });

  it('filtra por faixa de ano', () => {
    const list = [
      makeVehicle({ id: 'a', year: 2020 }),
      makeVehicle({ id: 'b', year: 2024 }),
    ];
    expect(filterEligibleVehicles(list, { yearFrom: 2023, yearTo: 2025 }, new Set(), new Map()).map(v => v.id)).toEqual(['b']);
  });

  it('filtra por categoria', () => {
    const list = [
      makeVehicle({ id: 'a', category: 'Leve' }),
      makeVehicle({ id: 'b', category: 'Pesado' }),
    ];
    expect(filterEligibleVehicles(list, { category: 'Leve' }, new Set(), new Map()).map(v => v.id)).toEqual(['a']);
  });

  it('filtra por unidade operacional', () => {
    const list = [
      makeVehicle({ id: 'a', operationalUnitId: 'u1' }),
      makeVehicle({ id: 'b', operationalUnitId: 'u2' }),
    ];
    expect(filterEligibleVehicles(list, { operationalUnitId: 'u1' }, new Set(), new Map()).map(v => v.id)).toEqual(['a']);
  });

  it('filtra por data de aquisição', () => {
    const list = [
      makeVehicle({ id: 'a', acquisitionDate: '2024-01-15' }),
      makeVehicle({ id: 'b', acquisitionDate: '2022-03-10' }),
    ];
    expect(filterEligibleVehicles(list, { acquisitionFrom: '2023-01-01', acquisitionTo: '2024-12-31' }, new Set(), new Map()).map(v => v.id)).toEqual(['a']);
  });

  it('filtra por KM atual máximo', () => {
    const list = [
      makeVehicle({ id: 'a' }),
      makeVehicle({ id: 'b' }),
    ];
    const km = new Map([['a', 5000], ['b', 30000]]);
    expect(filterEligibleVehicles(list, { maxCurrentKm: 10000 }, new Set(), km).map(v => v.id)).toEqual(['a']);
  });

  it('exclui veículo com plano ativo', () => {
    const list = [makeVehicle({ id: 'a' }), makeVehicle({ id: 'b' })];
    expect(filterEligibleVehicles(list, {}, new Set(['a']), new Map()).map(v => v.id)).toEqual(['b']);
  });

  it('requireWarrantyActive=true mantém só os com garantia', () => {
    const list = [
      makeVehicle({ id: 'a', warranty: true }),
      makeVehicle({ id: 'b', warranty: false }),
    ];
    expect(filterEligibleVehicles(list, { requireWarrantyActive: true }, new Set(), new Map()).map(v => v.id)).toEqual(['a']);
  });

  it('sem requireWarrantyActive: veículo sem garantia continua elegível (ajuste)', () => {
    const list = [
      makeVehicle({ id: 'a', warranty: true }),
      makeVehicle({ id: 'b', warranty: false }),
    ];
    expect(filterEligibleVehicles(list, {}, new Set(), new Map()).map(v => v.id).sort()).toEqual(['a', 'b']);
  });

  it('combina critérios', () => {
    const list = [
      makeVehicle({ id: 'a', brand: 'VW', model: 'Polo', year: 2024, operationalUnitId: 'u1', category: 'Leve', acquisitionDate: '2024-05-01', warranty: true }),
      makeVehicle({ id: 'b', brand: 'VW', model: 'Polo', year: 2023, operationalUnitId: 'u1', category: 'Leve', acquisitionDate: '2023-05-01', warranty: false }),
      makeVehicle({ id: 'c', brand: 'Fiat', model: 'Mobi', year: 2024, operationalUnitId: 'u2', category: 'Pesado', acquisitionDate: '2024-05-01', warranty: true }),
    ];
    const km = new Map([['a', 4000], ['b', 200000]]);
    const criteria: EligibilityCriteria = {
      brand: 'VW', model: 'Polo', yearFrom: 2020, yearTo: 2025,
      operationalUnitId: 'u1', category: 'Leve', acquisitionFrom: '2024-01-01', maxCurrentKm: 50000,
    };
    expect(filterEligibleVehicles(list, criteria, new Set(), km).map(v => v.id)).toEqual(['a']);
  });
});