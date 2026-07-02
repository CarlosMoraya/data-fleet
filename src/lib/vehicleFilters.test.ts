import { describe, expect, it } from 'vitest';

import {
  EMPTY_STRUCTURED_FILTERS,
  LEGACY_VEHICLE_ISSUE_VALUES,

  applyVehicleFilters,
  hasActiveStructuredFilters,
  hasLegacyVehicleParams,
  isVehiclePendency,
  parseSearchFromParams,
  parseVehicleFiltersFromParams,
  serializeVehicleFiltersToParams,
  vehicleMatchesPendency,
  vehicleMatchesSearch,
  type PendencyContext,
} from './vehicleFilters';

import type { Vehicle } from '../types';

const ctx: PendencyContext = {
  todayIso: '2026-06-17',
  currentYear: '2026',
  overdueChecklistVehicleIds: new Set(['v-overdue']),
};

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: 'v1',
    clientId: 'c1',
    active: true,
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
  };
}

describe('vehicleFilters', () => {
  it('faz round-trip parse/serialize com nomes novos', () => {
    const params = new URLSearchParams('issue=gr_expiring&shipper=s1&unit=u1');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed).toEqual({ shipperId: 's1', operationalUnitId: 'u1', pendency: 'gr_expiring' });
    expect(serializeVehicleFiltersToParams(parsed).toString()).toBe('shipper=s1&unit=u1&issue=gr_expiring');
  });

  it('faz parse com nomes legados (retrocompat) e converte valores', () => {
    const params = new URLSearchParams('embarcador=s1&unidade=u1&pendencia=crlv_vencido');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed).toEqual({ shipperId: 's1', operationalUnitId: 'u1', pendency: 'crlv_expired' });
  });

  it('serialize inclui busca textual como q', () => {
    const params = serializeVehicleFiltersToParams(
      { shipperId: 's1', operationalUnitId: null, pendency: 'crlv_expired' },
      'ABC'
    );
    expect(params.get('issue')).toBe('crlv_expired');
    expect(params.get('shipper')).toBe('s1');
    expect(params.get('q')).toBe('ABC');
  });

  it('parseSearchFromParams extrai q', () => {
    expect(parseSearchFromParams(new URLSearchParams('q=teste'))).toBe('teste');
    expect(parseSearchFromParams(new URLSearchParams())).toBe('');
  });

  it('hasLegacyVehicleParams detecta params legados', () => {
    expect(hasLegacyVehicleParams(new URLSearchParams('pendencia=crlv_vencido'))).toBe(true);
    expect(hasLegacyVehicleParams(new URLSearchParams('embarcador=s1'))).toBe(true);
    expect(hasLegacyVehicleParams(new URLSearchParams('unidade=u1'))).toBe(true);
    expect(hasLegacyVehicleParams(new URLSearchParams('issue=crlv_expired&shipper=s1&unit=u1'))).toBe(false);
  });

  it('normaliza pendência inválida para null', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams('pendencia=valor_invalido')).pendency).toBeNull();
  });

  it('retorna filtros vazios para query vazia', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams())).toEqual(EMPTY_STRUCTURED_FILTERS);
  });

  it('valida pendências conhecidas', () => {
    expect(isVehiclePendency('crlv_expired')).toBe(true);
    expect(isVehiclePendency('crlv_expiring')).toBe(true);
    expect(isVehiclePendency('gr_expiring')).toBe(true);
    expect(isVehiclePendency('gr_expired')).toBe(true);
    expect(isVehiclePendency('crlv_missing')).toBe(true);
    expect(isVehiclePendency('gr_missing')).toBe(true);
    expect(isVehiclePendency('insurance_missing')).toBe(true);
    expect(isVehiclePendency('maintenance_contract_missing')).toBe(true);
    expect(isVehiclePendency('no_driver')).toBe(true);
    expect(isVehiclePendency('checklist_overdue')).toBe(true);
    expect(isVehiclePendency(null)).toBe(false);
    expect(isVehiclePendency('desconhecida')).toBe(false);
  });

  it('migra valores legados corretamente', () => {
    expect(LEGACY_VEHICLE_ISSUE_VALUES['crlv_vencido']).toBe('crlv_expired');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['crlv_a_vencer']).toBe('crlv_expiring');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['gr_a_vencer']).toBe('gr_expiring');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['sem_motorista']).toBe('no_driver');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['checklist_vencido']).toBe('checklist_overdue');
  });

  it('indica presença de filtros estruturados ativos', () => {
    expect(hasActiveStructuredFilters(EMPTY_STRUCTURED_FILTERS)).toBe(false);
    expect(hasActiveStructuredFilters({ ...EMPTY_STRUCTURED_FILTERS, shipperId: 's1' })).toBe(true);
    expect(hasActiveStructuredFilters({ ...EMPTY_STRUCTURED_FILTERS, operationalUnitId: 'u1' })).toBe(true);
    expect(hasActiveStructuredFilters({ ...EMPTY_STRUCTURED_FILTERS, pendency: 'no_driver' })).toBe(true);
  });

  it('aplica pendência crlv_expired', () => {
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-01-01' }), 'crlv_expired', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-12-31' }), 'crlv_expired', ctx)).toBe(false);
    expect(vehicleMatchesPendency(vehicle({ crlvYear: '2025' }), 'crlv_expired', ctx)).toBe(true);
  });

  it('aplica pendência crlv_expiring', () => {
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-06-27' }), 'crlv_expiring', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-07-27' }), 'crlv_expiring', ctx)).toBe(false);
    expect(vehicleMatchesPendency(vehicle({ crlvExpirationDate: '2026-06-01' }), 'crlv_expiring', ctx)).toBe(false);
  });

  it('aplica pendência gr_expiring', () => {
    expect(vehicleMatchesPendency(vehicle({ grExpirationDate: '2026-06-22' }), 'gr_expiring', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ grExpirationDate: '2026-08-16' }), 'gr_expiring', ctx)).toBe(false);
  });

  it('aplica pendência gr_expired', () => {
    expect(vehicleMatchesPendency(vehicle({ grExpirationDate: '2026-06-10' }), 'gr_expired', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ grExpirationDate: '2026-06-17' }), 'gr_expired', ctx)).toBe(false);
  });

  it('aplica pendência crlv_missing', () => {
    expect(vehicleMatchesPendency(vehicle({ crlvUpload: '' }), 'crlv_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ crlvUpload: '   ' }), 'crlv_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ crlvUpload: 'file.pdf' }), 'crlv_missing', ctx)).toBe(false);
  });

  it('aplica pendência gr_missing', () => {
    expect(vehicleMatchesPendency(vehicle({ grUpload: '' }), 'gr_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ grUpload: 'gr.pdf' }), 'gr_missing', ctx)).toBe(false);
  });

  it('aplica pendência insurance_missing', () => {
    expect(vehicleMatchesPendency(vehicle({ hasInsurance: false }), 'insurance_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ hasInsurance: undefined }), 'insurance_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ hasInsurance: true }), 'insurance_missing', ctx)).toBe(false);
  });

  it('aplica pendência maintenance_contract_missing', () => {
    expect(vehicleMatchesPendency(vehicle({ hasMaintenanceContract: false }), 'maintenance_contract_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ hasMaintenanceContract: undefined }), 'maintenance_contract_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ hasMaintenanceContract: true }), 'maintenance_contract_missing', ctx)).toBe(false);
  });

  it('aplica pendência no_driver', () => {
    expect(vehicleMatchesPendency(vehicle({ driverId: undefined }), 'no_driver', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ driverId: 'd1' }), 'no_driver', ctx)).toBe(false);
  });

  it('aplica pendência checklist_overdue', () => {
    expect(vehicleMatchesPendency(vehicle({ id: 'v-overdue' }), 'checklist_overdue', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ id: 'v-ok' }), 'checklist_overdue', ctx)).toBe(false);
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

    expect(applyVehicleFilters(vehicles, 'abc', { shipperId: 's1', operationalUnitId: null, pendency: 'crlv_expired' }, ctx))
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

  it('preserva os valores legados de issue', () => {
    expect(LEGACY_VEHICLE_ISSUE_VALUES['crlv_vencido']).toBe('crlv_expired');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['crlv_a_vencer']).toBe('crlv_expiring');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['gr_a_vencer']).toBe('gr_expiring');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['sem_motorista']).toBe('no_driver');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['checklist_vencido']).toBe('checklist_overdue');
  });
});
