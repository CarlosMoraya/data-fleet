import { describe, expect, it } from 'vitest';

import {
  filterChecklistsByHistorySearch,
  filterVehiclesByPlate,
} from './checklistSearch';

const registros = [
  {
    id: 'c-plate',
    vehicleLicensePlate: 'ABC1D23',
    templateName: 'Rotina diária',
    templateContext: 'Rotina',
  },
  {
    id: 'c-other',
    vehicleLicensePlate: 'XYZ9A87',
    templateName: 'Auditoria de pátio',
    templateContext: 'Auditoria',
  },
  {
    id: 'c-accent',
    vehicleLicensePlate: null,
    templateName: 'Entrega de veículo',
    templateContext: 'Devolução',
  },
];

describe('filterChecklistsByHistorySearch', () => {
  it('filtra por placa completa', () => {
    expect(filterChecklistsByHistorySearch(registros, 'ABC1D23', true).map(({ id }) => id)).toEqual([
      'c-plate',
    ]);
  });

  it('filtra por trecho da placa', () => {
    expect(filterChecklistsByHistorySearch(registros, 'c1d2', true).map(({ id }) => id)).toEqual([
      'c-plate',
    ]);
  });

  it('filtra por contexto sem acento', () => {
    expect(filterChecklistsByHistorySearch(registros, 'auditoria', true).map(({ id }) => id)).toEqual([
      'c-other',
    ]);
  });

  it('filtra texto acentuado sem diferença de acentuação', () => {
    expect(filterChecklistsByHistorySearch(registros, 'devolucao', true).map(({ id }) => id)).toEqual([
      'c-accent',
    ]);
  });

  it('preserva o comportamento sem busca por placa', () => {
    expect(filterChecklistsByHistorySearch(registros, 'ABC1D23', false)).toEqual([]);
  });

  it('retorna todos na ordem original para consulta vazia', () => {
    expect(filterChecklistsByHistorySearch(registros, '   ', true).map(({ id }) => id)).toEqual([
      'c-plate',
      'c-other',
      'c-accent',
    ]);
  });

  it('retorna vazio sem correspondência', () => {
    expect(filterChecklistsByHistorySearch(registros, 'ZZZ000', true)).toEqual([]);
  });
});

describe('filterVehiclesByPlate', () => {
  it('filtra por trecho da placa', () => {
    const vehicles = [
      { id: 'v1', plate: 'ABC1D23' },
      { id: 'v2', plate: 'XYZ9A87' },
    ];

    expect(filterVehiclesByPlate(vehicles, 'bc1d').map(({ id }) => id)).toEqual(['v1']);
  });

  it('ignora placa nula sem lançar exceção', () => {
    const vehicles = [
      { id: 'v1', plate: 'ABC1D23' },
      { id: 'v2', plate: null },
    ];

    expect(filterVehiclesByPlate(vehicles, 'pesado')).toEqual([]);
  });
});
