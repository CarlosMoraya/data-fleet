import { describe, expect, it } from 'vitest';
import type { Vehicle } from '../types';
import {
  EMPTY_STRUCTURED_FILTERS,
  applyVehicleFilters,
  hasActiveStructuredFilters,
  isVehiclePendency,
  parseVehicleFiltersFromParams,
  serializeVehicleFiltersToParams,
  vehicleMatchesPendency,
  vehicleMatchesSearch,
  type PendencyContext,
} from './vehicleFilters';

const ctx: PendencyContext = {
  todayIso: '2026-06-17',
  currentYear: '2026',
  overdueChecklistVehicleIds: new Set(['v-overdue']),
};

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: 'v1',
    clientId: 'c1',
    type: 'Truck',
    energySource: 'Combustão',
    coolingEquipment: false,
    licensePlate: 'ABC1D23',
    renavam: '123',
    chassi: 'CHASSI123',
    detranUF: 'SP',
    brand: 'Ford',
    model: 'Cargo',
    year: 2024,
    color: 'Branco',
    acquisition: 'Owned',
    fipePrice: 100000,
    tracker: 'Sim',
    antt: 'ANTT',
    owner: 'Empresa',
    autonomy: 500,
    ...overrides,
  } as Vehicle;
}

describe('vehicleFilters', () => {
  it('faz round-trip parse/serialize preservando chaves válidas', () => {
    const params = new URLSearchParams('embarcador=s1&unidade=u1&pendencia=gr_a_vencer');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed).toEqual({ shipperId: 's1', operationalUnitId: 'u1', pendency: 'gr_a_vencer' });
    expect(serializeVehicleFiltersToParams(parsed).toString()).toBe('embarcador=s1&unidade=u1&pendencia=gr_a_vencer');
  });

  it('normaliza pendência inválida para null', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams('pendencia=valor_invalido')).pendency).toBeNull();
  });

  it('retorna filtros vazios para query vazia', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams())).toEqual(EMPTY_STRUCTURED_FILTERS);
  });

  it('valida pendências conhecidas', () => {
    expect(isVehiclePendency('crlv_vencido')).toBe(true);
    expect(isVehiclePendency('crlv_a_vencer')).toBe(true);
    expect(isVehiclePendency('gr_a_vencer')).toBe(true);
    expect(isVehiclePendency('sem_motorista')).toBe(true);
    expect(isVehiclePendency('checklist_vencido')).toBe(true);
    expect(isVehiclePendency(null)).toBe(false);
    expect(isVehiclePendency('desconhecida')).toBe(false);
  });

  it('indica presença de filtros estruturados ativos', () => {
    expect(hasActiveStructuredFilters(EMPTY_STRUCTURED_FILTERS)).toBe(false);
    expect(hasActiveStructuredFilters({ ...EMPTY_STRUCTURED_FILTERS, shipperId: 's1' })).toBe(true);
    expect(hasActiveStructuredFilters({ ...EMPTY_STRUCTURED_FILTERS, operationalUnitId: 'u1' })).toBe(true);
    expect(hasActiveStructuredFilters({ ...EMPTY_STRUCTURED_FILTERS, pendency: 'sem_motorista' })).toBe(true);
  });

  it('aplica pendência crlv_vencido', () => {
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-01-01' }), 'crlv_vencido', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-12-31' }), 'crlv_vencido', ctx)).toBe(false);
    expect(vehicleMatchesPendency(vehicle({ crlvYear: '2025' }), 'crlv_vencido', ctx)).toBe(true);
  });

  it('aplica pendência crlv_a_vencer', () => {
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-06-27' }), 'crlv_a_vencer', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-07-27' }), 'crlv_a_vencer', ctx)).toBe(false);
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-06-01' }), 'crlv_a_vencer', ctx)).toBe(false);
  });

  it('aplica pendência gr_a_vencer', () => {
    expect(vehicleMatchesPendency(vehicle({ grExpirationDate: '2026-06-22' }), 'gr_a_vencer', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ grExpirationDate: '2026-08-16' }), 'gr_a_vencer', ctx)).toBe(false);
  });

  it('aplica pendência sem_motorista', () => {
    expect(vehicleMatchesPendency(vehicle({ driverId: undefined }), 'sem_motorista', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ driverId: 'd1' }), 'sem_motorista', ctx)).toBe(false);
  });

  it('aplica pendência checklist_vencido', () => {
    expect(vehicleMatchesPendency(vehicle({ id: 'v-overdue' }), 'checklist_vencido', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ id: 'v-ok' }), 'checklist_vencido', ctx)).toBe(false);
  });

  it('busca por placa, modelo e chassi sem diferenciar maiúsculas', () => {
    const target = vehicle({ licensePlate: 'ABC1D23', brand: 'Mercedes', model: 'Actros', chassi: 'XYZ987' });

    expect(vehicleMatchesSearch(target, '')).toBe(true);
    expect(vehicleMatchesSearch(target, 'abc')).toBe(true);
    expect(vehicleMatchesSearch(target, 'actros')).toBe(true);
    expect(vehicleMatchesSearch(target, 'xyz')).toBe(true);
    expect(vehicleMatchesSearch(target, 'volvo')).toBe(false);
  });

  it('combina busca, embarcador e pendência com lógica E', () => {
    const vehicles = [
      vehicle({ id: 'v1', licensePlate: 'ABC1D23', shipperId: 's1', crlvExpirationDate: '2026-01-01' }),
      vehicle({ id: 'v2', licensePlate: 'ABC9Z99', shipperId: 's2', crlvExpirationDate: '2026-01-01' }),
      vehicle({ id: 'v3', licensePlate: 'DEF1D23', shipperId: 's1', crlvExpirationDate: '2026-12-31' }),
    ];

    expect(applyVehicleFilters(vehicles, 'abc', { shipperId: 's1', operationalUnitId: null, pendency: 'crlv_vencido' }, ctx))
      .toEqual([vehicles[0]]);
  });

  it('retorna todos quando não há busca nem filtros', () => {
    const vehicles = [vehicle({ id: 'v1' }), vehicle({ id: 'v2' })];

    expect(applyVehicleFilters(vehicles, '', EMPTY_STRUCTURED_FILTERS, ctx)).toEqual(vehicles);
  });

  it('retorna vazio quando embarcador não casa com nenhum veículo', () => {
    const vehicles = [vehicle({ id: 'v1', shipperId: 's1' })];

    expect(applyVehicleFilters(vehicles, '', { ...EMPTY_STRUCTURED_FILTERS, shipperId: 's2' }, ctx)).toEqual([]);
  });
});
