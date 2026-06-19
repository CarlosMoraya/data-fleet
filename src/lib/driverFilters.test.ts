import { describe, expect, it } from 'vitest';
import type { Driver } from '../types';
import {
  DRIVER_PENDENCY_VALUES,
  EMPTY_DRIVER_FILTERS,
  applyDriverFilters,
  driverMatchesPendency,
  driverMatchesSearch,
  hasActiveDriverFilters,
  isDriverPendency,
  parseDriverFiltersFromParams,
  serializeDriverFiltersToParams,
  type DriverFilterContext,
} from './driverFilters';

const ctx: DriverFilterContext = {
  todayIso: '2026-06-19',
  vehicleByDriverId: {
    d1: { shipperId: 's1', operationalUnitId: 'u1' },
    d3: { shipperId: 's2', operationalUnitId: 'u2' },
  },
};

function driver(overrides: Partial<Driver>): Driver {
  return {
    id: 'd1',
    clientId: 'c1',
    name: 'Maria da Silva',
    cpf: '12345678901',
    ...overrides,
  };
}

describe('driverFilters', () => {
  it('faz round-trip parse/serialize preservando chaves válidas', () => {
    const params = new URLSearchParams('embarcador=s1&unidade=u1&situacao=gr_a_vencer');
    const parsed = parseDriverFiltersFromParams(params);

    expect(parsed).toEqual({ shipperId: 's1', operationalUnitId: 'u1', pendency: 'gr_a_vencer' });
    expect(serializeDriverFiltersToParams(parsed).toString()).toBe('embarcador=s1&unidade=u1&situacao=gr_a_vencer');
  });

  it('normaliza situação inválida para null', () => {
    expect(parseDriverFiltersFromParams(new URLSearchParams('situacao=xpto')).pendency).toBeNull();
  });

  it('retorna filtros vazios para query vazia', () => {
    expect(parseDriverFiltersFromParams(new URLSearchParams())).toEqual(EMPTY_DRIVER_FILTERS);
  });

  it('valida as 5 situações conhecidas', () => {
    for (const value of DRIVER_PENDENCY_VALUES) {
      expect(isDriverPendency(value)).toBe(true);
    }
    expect(isDriverPendency(null)).toBe(false);
    expect(isDriverPendency('desconhecida')).toBe(false);
  });

  it('indica presença de filtros estruturados ativos', () => {
    expect(hasActiveDriverFilters(EMPTY_DRIVER_FILTERS)).toBe(false);
    expect(hasActiveDriverFilters({ ...EMPTY_DRIVER_FILTERS, shipperId: 's1' })).toBe(true);
    expect(hasActiveDriverFilters({ ...EMPTY_DRIVER_FILTERS, operationalUnitId: 'u1' })).toBe(true);
    expect(hasActiveDriverFilters({ ...EMPTY_DRIVER_FILTERS, pendency: 'sem_veiculo' })).toBe(true);
  });

  it('aplica situação cnh_vencida', () => {
    expect(driverMatchesPendency(driver({ expirationDate: '2026-06-01' }), 'cnh_vencida', ctx)).toBe(true);
    expect(driverMatchesPendency(driver({ expirationDate: '2026-07-01' }), 'cnh_vencida', ctx)).toBe(false);
    expect(driverMatchesPendency(driver({ expirationDate: undefined }), 'cnh_vencida', ctx)).toBe(false);
  });

  it('aplica situação cnh_a_vencer', () => {
    expect(driverMatchesPendency(driver({ expirationDate: '2026-06-25' }), 'cnh_a_vencer', ctx)).toBe(true);
    expect(driverMatchesPendency(driver({ expirationDate: '2026-08-01' }), 'cnh_a_vencer', ctx)).toBe(false);
    expect(driverMatchesPendency(driver({ expirationDate: '2026-06-01' }), 'cnh_a_vencer', ctx)).toBe(false);
  });

  it('aplica situação gr_a_vencer', () => {
    expect(driverMatchesPendency(driver({ grExpirationDate: '2026-06-20' }), 'gr_a_vencer', ctx)).toBe(true);
    expect(driverMatchesPendency(driver({ grExpirationDate: '2026-08-01' }), 'gr_a_vencer', ctx)).toBe(false);
  });

  it('aplica situação com_veiculo e sem_veiculo', () => {
    expect(driverMatchesPendency(driver({ id: 'd1' }), 'com_veiculo', ctx)).toBe(true);
    expect(driverMatchesPendency(driver({ id: 'd2' }), 'com_veiculo', ctx)).toBe(false);
    expect(driverMatchesPendency(driver({ id: 'd2' }), 'sem_veiculo', ctx)).toBe(true);
    expect(driverMatchesPendency(driver({ id: 'd1' }), 'sem_veiculo', ctx)).toBe(false);
  });

  it('busca por nome e CPF sem casar CPF quando não há dígitos', () => {
    const maria = driver({ id: 'd1', name: 'Maria da Silva', cpf: '12345678901' });
    const joao = driver({ id: 'd2', name: 'Joao Santos', cpf: '99988877766' });

    expect(driverMatchesSearch(maria, '')).toBe(true);
    expect(driverMatchesSearch(maria, 'maria')).toBe(true);
    expect(driverMatchesSearch(maria, '456.789')).toBe(true);
    expect(driverMatchesSearch(joao, 'maria')).toBe(false);
  });

  it('combina busca, embarcador e situação com lógica E', () => {
    const drivers = [
      driver({ id: 'd1', name: 'Maria Silva', cpf: '12345678901', expirationDate: '2026-06-01' }),
      driver({ id: 'd2', name: 'Maria Souza', cpf: '11122233344', expirationDate: '2026-06-01' }),
      driver({ id: 'd3', name: 'Maria Costa', cpf: '55566677788', expirationDate: '2026-12-01' }),
    ];

    expect(applyDriverFilters(drivers, 'maria', { shipperId: 's1', operationalUnitId: null, pendency: 'cnh_vencida' }, ctx))
      .toEqual([drivers[0]]);
  });

  it('filtra por unidade operacional do veículo vinculado', () => {
    const drivers = [
      driver({ id: 'd1', name: 'Maria Silva' }),
      driver({ id: 'd2', name: 'Joao Santos' }),
      driver({ id: 'd3', name: 'Ana Costa' }),
    ];

    expect(applyDriverFilters(drivers, '', { ...EMPTY_DRIVER_FILTERS, operationalUnitId: 'u2' }, ctx)).toEqual([drivers[2]]);
  });

  it('serializa apenas chaves estruturadas e nunca inclui PII', () => {
    const params = serializeDriverFiltersToParams({
      shipperId: 's1',
      operationalUnitId: 'u1',
      pendency: 'gr_a_vencer',
    });
    const serialized = params.toString();
    const sampleDriver = driver({ name: 'Maria da Silva', cpf: '12345678901' });

    expect([...params.keys()]).toEqual(['embarcador', 'unidade', 'situacao']);
    expect(serialized).not.toContain(sampleDriver.name);
    expect(serialized).not.toContain(sampleDriver.cpf);
  });
});
