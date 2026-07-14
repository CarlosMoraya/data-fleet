import { describe, expect, it } from 'vitest';

import {
  AVAILABILITY_AVAILABLE,
  AVAILABILITY_UNAVAILABLE,
  applyAvailabilityFilter,
  buildAvailabilityChartData,
  computeUnavailableVehicleIds,
  toggleAvailabilityValue,
} from './overviewFleetFilters';

import type { VehicleRow } from '../components/dashboard/OperationalPanel';

function makeVehicle(id: string): VehicleRow {
  return { id } as VehicleRow;
}

describe('applyAvailabilityFilter', () => {
  it('retorna apenas o veículo indisponível quando filtro é Indisponíveis', () => {
    const vehicles = [makeVehicle('1'), makeVehicle('2')];
    const unavailableIds = new Set(['1']);
    const result = applyAvailabilityFilter(vehicles, unavailableIds, [AVAILABILITY_UNAVAILABLE]);
    expect(result.map((v) => v.id)).toEqual(['1']);
  });

  it('retorna apenas os veículos disponíveis quando filtro é Disponíveis', () => {
    const vehicles = [makeVehicle('1'), makeVehicle('2')];
    const unavailableIds = new Set(['1']);
    const result = applyAvailabilityFilter(vehicles, unavailableIds, [AVAILABILITY_AVAILABLE]);
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it('retorna todos quando seleção está vazia', () => {
    const vehicles = [makeVehicle('1'), makeVehicle('2')];
    const result = applyAvailabilityFilter(vehicles, new Set(['1']), []);
    expect(result).toEqual(vehicles);
  });

  it('retorna todos quando ambos os valores estão selecionados', () => {
    const vehicles = [makeVehicle('1'), makeVehicle('2')];
    const result = applyAvailabilityFilter(vehicles, new Set(['1']), [
      AVAILABILITY_AVAILABLE,
      AVAILABILITY_UNAVAILABLE,
    ]);
    expect(result).toEqual(vehicles);
  });
});

describe('toggleAvailabilityValue', () => {
  it('clique simples em valor não selecionado retorna apenas esse valor', () => {
    const result = toggleAvailabilityValue([], AVAILABILITY_AVAILABLE, false);
    expect(result).toEqual([AVAILABILITY_AVAILABLE]);
  });

  it('clique simples no único valor selecionado limpa a seleção', () => {
    const result = toggleAvailabilityValue([AVAILABILITY_AVAILABLE], AVAILABILITY_AVAILABLE, false);
    expect(result).toEqual([]);
  });

  it('modo aditivo adiciona mantendo os demais', () => {
    const result = toggleAvailabilityValue([AVAILABILITY_AVAILABLE], AVAILABILITY_UNAVAILABLE, true);
    expect(result).toEqual([AVAILABILITY_AVAILABLE, AVAILABILITY_UNAVAILABLE]);
  });

  it('modo aditivo remove mantendo os demais', () => {
    const result = toggleAvailabilityValue(
      [AVAILABILITY_AVAILABLE, AVAILABILITY_UNAVAILABLE],
      AVAILABILITY_AVAILABLE,
      true,
    );
    expect(result).toEqual([AVAILABILITY_UNAVAILABLE]);
  });
});

describe('buildAvailabilityChartData', () => {
  it('calcula disponíveis e indisponíveis corretamente', () => {
    const vehicles = Array.from({ length: 10 }, (_, i) => makeVehicle(String(i)));
    const unavailableIds = new Set(['0', '1', '2']);
    const result = buildAvailabilityChartData(vehicles, unavailableIds);
    expect(result).toEqual([
      { name: AVAILABILITY_AVAILABLE, value: 7 },
      { name: AVAILABILITY_UNAVAILABLE, value: 3 },
    ]);
  });

  it('retorna zero para ambos quando não há veículos', () => {
    const result = buildAvailabilityChartData([], new Set());
    expect(result).toEqual([
      { name: AVAILABILITY_AVAILABLE, value: 0 },
      { name: AVAILABILITY_UNAVAILABLE, value: 0 },
    ]);
  });
});

describe('computeUnavailableVehicleIds', () => {
  it('inclui veículos com status ativo dentro do conjunto permitido', () => {
    const orders = [{ vehicle_id: '1', status: 'Em andamento' }];
    const result = computeUnavailableVehicleIds(orders, new Set(['1']));
    expect(result.has('1')).toBe(true);
  });

  it('não inclui veículos com status inativo', () => {
    const orders = [{ vehicle_id: '1', status: 'Concluído' }];
    const result = computeUnavailableVehicleIds(orders, new Set(['1']));
    expect(result.has('1')).toBe(false);
  });

  it('não inclui veículos fora do conjunto permitido', () => {
    const orders = [{ vehicle_id: '1', status: 'Em andamento' }];
    const result = computeUnavailableVehicleIds(orders, new Set(['2']));
    expect(result.has('1')).toBe(false);
  });

  it('deduplica por vehicle_id', () => {
    const orders = [
      { vehicle_id: '1', status: 'Em andamento' },
      { vehicle_id: '1', status: 'Aguardando peça' },
    ];
    const result = computeUnavailableVehicleIds(orders, new Set(['1']));
    expect(result.size).toBe(1);
  });
});
