import { describe, expect, it } from 'vitest';

import {
  EMPTY_STRUCTURED_FILTERS,
  LAST_ROUTE_NONE,
  LAST_ROUTE_OLDER_30D,
  LAST_ROUTE_OLDER_7D,
  LEGACY_VEHICLE_ISSUE_VALUES,
  applyVehicleFilters,
  buildLastRouteFilterOptions,
  hasActiveStructuredFilters,
  hasLegacyVehicleParams,
  isVehicleAvailability,
  isVehiclePendency,
  parseSearchFromParams,
  parseVehicleFiltersFromParams,
  serializeVehicleFiltersToParams,
  vehicleMatchesLastRoute,
  vehicleMatchesPendency,
  vehicleMatchesSearch,
  type PendencyContext,
  type VehicleStructuredFilters,
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

const normalizePlate = (plate: string) => plate
  .replace(/[^A-Za-z0-9]/g, '')
  .toUpperCase()
  .slice(-7);

function filters(overrides: Partial<VehicleStructuredFilters>): VehicleStructuredFilters {
  return { ...EMPTY_STRUCTURED_FILTERS, ...overrides };
}

describe('vehicleFilters', () => {
  it('faz round-trip parse/serialize com nomes novos', () => {
    const params = new URLSearchParams('issue=gr_expiring&shipper=s1&unit=u1');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed).toEqual({
      shipperIds: ['s1'],
      operationalUnitIds: ['u1'],
      pendencies: ['gr_expiring'],
      lastRoutes: [],
      availability: [],
    });
    expect(serializeVehicleFiltersToParams(parsed).toString()).toBe('shipper=s1&unit=u1&issue=gr_expiring');
  });

  it('faz parse com nomes legados (retrocompat) e converte valores', () => {
    const params = new URLSearchParams('embarcador=s1&unidade=u1&pendencia=crlv_vencido');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed).toEqual({
      shipperIds: ['s1'],
      operationalUnitIds: ['u1'],
      pendencies: ['crlv_expired'],
      lastRoutes: [],
      availability: [],
    });
  });

  it('parseia dois shipper, unit e issue em arrays', () => {
    const params = new URLSearchParams('shipper=s1&shipper=s2&unit=u1&unit=u2&issue=crlv_expired&issue=no_driver');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed.shipperIds).toEqual(['s1', 's2']);
    expect(parsed.operationalUnitIds).toEqual(['u1', 'u2']);
    expect(parsed.pendencies).toEqual(['crlv_expired', 'no_driver']);
  });

  it('serializa por parâmetros repetidos', () => {
    const params = serializeVehicleFiltersToParams(filters({
      shipperIds: ['s1', 's2'],
      operationalUnitIds: ['u1'],
      pendencies: ['crlv_expired', 'no_driver'],
    }));

    expect(params.getAll('shipper')).toEqual(['s1', 's2']);
    expect(params.getAll('issue')).toEqual(['crlv_expired', 'no_driver']);
    expect(params.toString()).toBe('shipper=s1&shipper=s2&unit=u1&issue=crlv_expired&issue=no_driver');
  });

  it('deduplica valores e descarta códigos inválidos', () => {
    const params = new URLSearchParams('shipper=s1&shipper=s1&issue=crlv_expired&issue=valor_invalido&issue=crlv_expired');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed.shipperIds).toEqual(['s1']);
    expect(parsed.pendencies).toEqual(['crlv_expired']);
  });

  it('canônico prevalece sobre legado por dimensão', () => {
    const params = new URLSearchParams('shipper=s1&embarcador=legado&unit=u1&unidade=legada');
    const parsed = parseVehicleFiltersFromParams(params);

    expect(parsed.shipperIds).toEqual(['s1']);
    expect(parsed.operationalUnitIds).toEqual(['u1']);
  });

  it('links legados singulares continuam válidos', () => {
    const parsed = parseVehicleFiltersFromParams(new URLSearchParams('embarcador=s1&unidade=u1&pendencia=crlv_vencido'));

    expect(parsed.shipperIds).toEqual(['s1']);
    expect(parsed.operationalUnitIds).toEqual(['u1']);
    expect(parsed.pendencies).toEqual(['crlv_expired']);
  });

  it('serialize inclui busca textual como q e preserva q', () => {
    const params = serializeVehicleFiltersToParams(
      filters({ shipperIds: ['s1'], pendencies: ['crlv_expired'] }),
      'ABC',
    );
    expect(params.getAll('issue')).toEqual(['crlv_expired']);
    expect(params.getAll('shipper')).toEqual(['s1']);
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

  it('normaliza pendência inválida para array vazio', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams('pendencia=valor_invalido')).pendencies).toEqual([]);
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
    expect(isVehiclePendency('tracker_missing')).toBe(true);
    expect(isVehiclePendency(null)).toBe(false);
    expect(isVehiclePendency('desconhecida')).toBe(false);
  });

  it('valida os valores de disponibilidade', () => {
    expect(isVehicleAvailability('available')).toBe(true);
    expect(isVehicleAvailability('unavailable')).toBe(true);
    expect(isVehicleAvailability('qualquer')).toBe(false);
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
    expect(hasActiveStructuredFilters(filters({ shipperIds: ['s1'] }))).toBe(true);
    expect(hasActiveStructuredFilters(filters({ operationalUnitIds: ['u1'] }))).toBe(true);
    expect(hasActiveStructuredFilters(filters({ pendencies: ['no_driver'] }))).toBe(true);
    expect(hasActiveStructuredFilters(filters({ lastRoutes: ['2026-08-15'] }))).toBe(true);
    expect(hasActiveStructuredFilters(filters({ availability: ['available'] }))).toBe(true);
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

  it('aplica pendência tracker_missing', () => {
    expect(vehicleMatchesPendency(vehicle({ tracker: '' }), 'tracker_missing', ctx)).toBe(true);
    expect(vehicleMatchesPendency(vehicle({ tracker: 'Sascar' }), 'tracker_missing', ctx)).toBe(false);
  });

  it('não marca semirreboque/implemento como sem rastreador', () => {
    expect(vehicleMatchesPendency(vehicle({ tracker: '', type: 'Semirreboque' }), 'tracker_missing', ctx)).toBe(false);
    expect(vehicleMatchesPendency(vehicle({ tracker: '', category: 'Semi-reboque/Implemento' }), 'tracker_missing', ctx)).toBe(false);
  });

  it('aceita issue=tracker_missing vindo da URL', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams('issue=tracker_missing')).pendencies).toEqual(['tracker_missing']);
  });

  it('serializa tracker_missing de volta para a URL', () => {
    const parsed = parseVehicleFiltersFromParams(new URLSearchParams('issue=tracker_missing'));
    expect(serializeVehicleFiltersToParams(parsed).toString()).toBe('issue=tracker_missing');
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

    expect(applyVehicleFilters(vehicles, 'abc', filters({
      shipperIds: ['s1'],
      pendencies: ['crlv_expired'],
    }), ctx))
      .toEqual([vehicles[0]]);
  });

  it('combina duas pendências com lógica OR dentro da dimensão', () => {
    const vehicles = [
      vehicle({ id: 'v1', crlvExpirationDate: '2026-01-01' }),
      vehicle({ id: 'v2', driverId: undefined }),
      vehicle({ id: 'v3', crlvExpirationDate: '2026-12-31', driverId: 'd1' }),
    ];

    expect(applyVehicleFilters(vehicles, '', filters({
      pendencies: ['crlv_expired', 'no_driver'],
    }), ctx))
      .toEqual([vehicles[0], vehicles[1]]);
  });

  it('combina embarcador, unidade, pendência e busca com AND entre dimensões', () => {
    const vehicles = [
      vehicle({ id: 'v1', shipperId: 's1', operationalUnitId: 'u1', crlvExpirationDate: '2026-01-01', licensePlate: 'ABC1D23' }),
      vehicle({ id: 'v2', shipperId: 's1', operationalUnitId: 'u2', crlvExpirationDate: '2026-01-01', licensePlate: 'ABC9Z99' }),
      vehicle({ id: 'v3', shipperId: 's2', operationalUnitId: 'u1', crlvExpirationDate: '2026-01-01', licensePlate: 'DEF1D23' }),
    ];

    expect(applyVehicleFilters(vehicles, 'abc', filters({
      shipperIds: ['s1'],
      operationalUnitIds: ['u1'],
      pendencies: ['crlv_expired'],
    }), ctx))
      .toEqual([vehicles[0]]);
  });

  it('aceita dois embarcadores na mesma dimensão com OR', () => {
    const vehicles = [
      vehicle({ id: 'v1', shipperId: 's1' }),
      vehicle({ id: 'v2', shipperId: 's2' }),
      vehicle({ id: 'v3', shipperId: 's3' }),
    ];

    expect(applyVehicleFilters(vehicles, '', filters({ shipperIds: ['s1', 's3'] }), ctx))
      .toEqual([vehicles[0], vehicles[2]]);
  });

  it('aplica disponíveis, indisponíveis e ambos', () => {
    const vehicles = [
      vehicle({ id: 'v1' }),
      vehicle({ id: 'v2' }),
      vehicle({ id: 'v3' }),
    ];
    const unavailable = new Set(['v2']);

    expect(applyVehicleFilters(vehicles, '', filters({ availability: ['available'] }), ctx, unavailable))
      .toEqual([vehicles[0], vehicles[2]]);
    expect(applyVehicleFilters(vehicles, '', filters({ availability: ['unavailable'] }), ctx, unavailable))
      .toEqual([vehicles[1]]);
    expect(applyVehicleFilters(vehicles, '', filters({ availability: ['available', 'unavailable'] }), ctx, unavailable))
      .toEqual(vehicles);
  });

  it('não aplica disponibilidade quando o conjunto de indisponíveis é desconhecido', () => {
    const vehicles = [vehicle({ id: 'v1' }), vehicle({ id: 'v2' })];

    expect(applyVehicleFilters(vehicles, '', filters({ availability: ['unavailable'] }), ctx))
      .toEqual(vehicles);
  });

  it('retorna todos quando não há busca nem filtros', () => {
    const vehicles = [vehicle({ id: 'v1' }), vehicle({ id: 'v2' })];

    expect(applyVehicleFilters(vehicles, '', EMPTY_STRUCTURED_FILTERS, ctx)).toEqual(vehicles);
  });

  it('retorna vazio quando embarcador não casa com nenhum veículo', () => {
    const vehicles = [vehicle({ id: 'v1', shipperId: 's1' })];

    expect(applyVehicleFilters(vehicles, '', filters({ shipperIds: ['s2'] }), ctx)).toEqual([]);
  });

  it('arrays vazios não restringem a listagem', () => {
    const vehicles = [vehicle({ id: 'v1', shipperId: 's1' }), vehicle({ id: 'v2', shipperId: 's2' })];

    expect(applyVehicleFilters(vehicles, '', EMPTY_STRUCTURED_FILTERS, ctx)).toEqual(vehicles);
  });

  it('preserva os valores legados de issue', () => {
    expect(LEGACY_VEHICLE_ISSUE_VALUES['crlv_vencido']).toBe('crlv_expired');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['crlv_a_vencer']).toBe('crlv_expiring');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['gr_a_vencer']).toBe('gr_expiring');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['sem_motorista']).toBe('no_driver');
    expect(LEGACY_VEHICLE_ISSUE_VALUES['checklist_vencido']).toBe('checklist_overdue');
  });

  it('lê valores válidos de lastRoute e rejeita valores inválidos', () => {
    expect(parseVehicleFiltersFromParams(new URLSearchParams('lastRoute=2026-08-15')).lastRoutes)
      .toEqual(['2026-08-15']);
    expect(parseVehicleFiltersFromParams(new URLSearchParams('lastRoute=none')).lastRoutes)
      .toEqual([LAST_ROUTE_NONE]);
    expect(parseVehicleFiltersFromParams(new URLSearchParams('lastRoute=older_7d')).lastRoutes)
      .toEqual([LAST_ROUTE_OLDER_7D]);
    expect(parseVehicleFiltersFromParams(new URLSearchParams('lastRoute=older_30d')).lastRoutes)
      .toEqual([LAST_ROUTE_OLDER_30D]);
    expect(parseVehicleFiltersFromParams(new URLSearchParams('lastRoute=ontem')).lastRoutes).toEqual([]);
    expect(parseVehicleFiltersFromParams(new URLSearchParams('lastRoute=2026-13-99')).lastRoutes).toEqual([]);
  });

  it('serializa e omite lastRoute corretamente', () => {
    const withLastRoute = serializeVehicleFiltersToParams(filters({ lastRoutes: ['2026-08-15'] }));
    expect(withLastRoute.getAll('lastRoute')).toEqual(['2026-08-15']);
    expect(serializeVehicleFiltersToParams(EMPTY_STRUCTURED_FILTERS).has('lastRoute')).toBe(false);
  });

  it('deriva opções de última rota na ordem e com as contagens esperadas', () => {
    const vehicles = Array.from({ length: 10 }, (_, index) => vehicle({
      id: `v${index + 1}`,
      licensePlate: `AAA0A${String(index + 1).padStart(2, '0')}`,
    }));
    const routes = new Map<string, { lastRouteDate: string }>([
      [normalizePlate(vehicles[0].licensePlate), { lastRouteDate: '2026-08-15' }],
      [normalizePlate(vehicles[1].licensePlate), { lastRouteDate: '2026-08-15' }],
      [normalizePlate(vehicles[2].licensePlate), { lastRouteDate: '2026-08-15' }],
      [normalizePlate(vehicles[3].licensePlate), { lastRouteDate: '2026-08-12' }],
      [normalizePlate(vehicles[4].licensePlate), { lastRouteDate: '2026-08-12' }],
      [normalizePlate(vehicles[5].licensePlate), { lastRouteDate: '2026-08-05' }],
      [normalizePlate(vehicles[6].licensePlate), { lastRouteDate: '2026-08-05' }],
      [normalizePlate(vehicles[7].licensePlate), { lastRouteDate: '2026-06-16' }],
    ]);

    const options = buildLastRouteFilterOptions(vehicles, routes, normalizePlate);

    expect(options).toEqual([
      { value: '2026-08-15', label: '15/08/2026', count: 3 },
      { value: '2026-08-12', label: '12/08/2026', count: 2 },
      { value: LAST_ROUTE_OLDER_7D, label: 'Há mais de 7 dias', count: 2 },
      { value: LAST_ROUTE_OLDER_30D, label: 'Há mais de 30 dias', count: 1 },
      { value: LAST_ROUTE_NONE, label: 'Sem rota registrada', count: 2 },
    ]);
    expect(options.reduce((sum, option) => sum + option.count, 0)).toBe(10);
  });

  it('omite opções sem veículos', () => {
    const vehicles = [
      vehicle({ id: 'v1', licensePlate: 'AAA0A01' }),
      vehicle({ id: 'v2', licensePlate: 'AAA0A02' }),
    ];
    const routes = new Map([
      ['AAA0A01', { lastRouteDate: '2026-08-15' }],
      ['AAA0A02', { lastRouteDate: '2026-08-05' }],
    ]);

    const options = buildLastRouteFilterOptions(vehicles, routes, normalizePlate);

    expect(options.some((option) => option.value === LAST_ROUTE_NONE)).toBe(false);
    expect(options.some((option) => option.value === LAST_ROUTE_OLDER_30D)).toBe(false);
  });

  it('devolve somente Sem rota registrada quando toda a frota está sem rota', () => {
    const vehicles = [vehicle({ id: 'v1' }), vehicle({ id: 'v2', licensePlate: 'DEF4G56' })];

    expect(buildLastRouteFilterOptions(vehicles, new Map(), normalizePlate)).toEqual([
      { value: LAST_ROUTE_NONE, label: 'Sem rota registrada', count: 2 },
    ]);
  });

  it('casa os quatro tipos de filtro de última rota', () => {
    const target = vehicle({ licensePlate: 'ABC1D23' });
    const routes = new Map([['ABC1D23', { lastRouteDate: '2026-08-05' }]]);

    expect(vehicleMatchesLastRoute(target, '2026-08-05', routes, normalizePlate, '2026-08-15')).toBe(true);
    expect(vehicleMatchesLastRoute(target, LAST_ROUTE_OLDER_7D, routes, normalizePlate, '2026-08-15')).toBe(true);
    expect(vehicleMatchesLastRoute(target, LAST_ROUTE_OLDER_30D, routes, normalizePlate, '2026-08-15')).toBe(false);
    expect(vehicleMatchesLastRoute(
      vehicle({ licensePlate: 'DEF4G56' }),
      LAST_ROUTE_NONE,
      routes,
      normalizePlate,
      '2026-08-15',
    )).toBe(true);
  });

  it('combina duas opções de última rota com OR', () => {
    const vehicles = [
      vehicle({ id: 'v1', licensePlate: 'ABC1D23' }),
      vehicle({ id: 'v2', licensePlate: 'DEF4G56' }),
      vehicle({ id: 'v3', licensePlate: 'GHI7J89' }),
    ];
    const routes = new Map([
      ['ABC1D23', { lastRouteDate: '2026-08-15' }],
      ['GHI7J89', { lastRouteDate: '2026-06-10' }],
    ]);

    expect(applyVehicleFilters(
      vehicles,
      '',
      filters({ lastRoutes: ['2026-08-15', LAST_ROUTE_NONE] }),
      ctx,
      undefined,
      routes,
      normalizePlate,
    )).toEqual([vehicles[0], vehicles[1]]);
  });

  it('respeita as bordas de 7, 8, 30 e 31 dias', () => {
    const dates = [
      ['AGE0007', '2026-08-08'],
      ['AGE0008', '2026-08-07'],
      ['AGE0030', '2026-07-16'],
      ['AGE0031', '2026-07-15'],
    ] as const;
    const routes = new Map(dates.map(([plate, lastRouteDate]) => [plate, { lastRouteDate }]));

    for (const [plate] of dates.slice(0, 3)) {
      expect(vehicleMatchesLastRoute(
        vehicle({ licensePlate: plate }),
        LAST_ROUTE_OLDER_7D,
        routes,
        normalizePlate,
        '2026-08-15',
      )).toBe(true);
    }
    expect(vehicleMatchesLastRoute(
      vehicle({ licensePlate: 'AGE0031' }),
      LAST_ROUTE_OLDER_7D,
      routes,
      normalizePlate,
      '2026-08-15',
    )).toBe(false);
    expect(vehicleMatchesLastRoute(
      vehicle({ licensePlate: 'AGE0031' }),
      LAST_ROUTE_OLDER_30D,
      routes,
      normalizePlate,
      '2026-08-15',
    )).toBe(true);
  });

  it('normaliza o prefixo sujo da placa antes de casar a frota', () => {
    const routes = new Map([
      [normalizePlate('SDD-TEV8C85'), { lastRouteDate: '2026-08-15' }],
    ]);

    expect(vehicleMatchesLastRoute(
      vehicle({ licensePlate: 'TEV8C85' }),
      '2026-08-15',
      routes,
      normalizePlate,
      '2026-08-15',
    )).toBe(true);
  });

  it('preserva o resultado anterior quando o mapa e o normalizador não são informados', () => {
    const vehicles = [
      vehicle({ id: 'v1', shipperId: 's1' }),
      vehicle({ id: 'v2', shipperId: 's2' }),
    ];
    const activeFilters = filters({ shipperIds: ['s1'], lastRoutes: ['2026-08-15'] });

    expect(applyVehicleFilters(vehicles, '', activeFilters, ctx)).toEqual([vehicles[0]]);
  });

  it('combina última rota com embarcador e busca textual', () => {
    const vehicles = [
      vehicle({ id: 'v1', licensePlate: 'ABC1D23', shipperId: 's1' }),
      vehicle({ id: 'v2', licensePlate: 'ABC9Z99', shipperId: 's2' }),
      vehicle({ id: 'v3', licensePlate: 'DEF1D23', shipperId: 's1' }),
    ];
    const routes = new Map(vehicles.map((item) => [
      normalizePlate(item.licensePlate),
      { lastRouteDate: '2026-08-15' },
    ]));

    expect(applyVehicleFilters(
      vehicles,
      'abc',
      filters({ shipperIds: ['s1'], lastRoutes: ['2026-08-15'] }),
      ctx,
      undefined,
      routes,
      normalizePlate,
    )).toEqual([vehicles[0]]);
  });
});
