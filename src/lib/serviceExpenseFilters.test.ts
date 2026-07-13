import { describe, expect, it } from 'vitest';

import { computeExtraPaymentCounts, filterExtraPayments, matchesExtraPaymentSearch } from './serviceExpenseFilters';

import type { ExtraPaymentRequest } from '../types/serviceExpense';

function baseItem(overrides: Partial<ExtraPaymentRequest> = {}): ExtraPaymentRequest {
  return {
    id: 'epr-1',
    clientId: 'client-1',
    requestNumber: 'PE-2607-0001',
    category: 'guincho',
    serviceDate: '2026-07-10',
    supplierName: 'Guincho Rápido LTDA',
    amount: 350,
    status: 'pendente_aprovacao',
    createdById: 'user-1',
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    ...overrides,
  };
}

describe('matchesExtraPaymentSearch', () => {
  it('busca por fornecedor', () => {
    const item = baseItem({ supplierName: 'Borracharia do Zé', category: 'outro' });
    expect(matchesExtraPaymentSearch(item, 'borracharia')).toBe(true);
    expect(matchesExtraPaymentSearch(item, 'guincho')).toBe(false);
  });

  it('busca por placa', () => {
    const item = baseItem({ vehicleLicensePlate: 'ABC1D23' });
    expect(matchesExtraPaymentSearch(item, 'abc1d23')).toBe(true);
  });

  it('busca por motorista', () => {
    const item = baseItem({ driverName: 'João Motorista' });
    expect(matchesExtraPaymentSearch(item, 'joão')).toBe(true);
  });

  it('termo vazio casa tudo', () => {
    expect(matchesExtraPaymentSearch(baseItem(), '   ')).toBe(true);
  });
});

describe('filterExtraPayments', () => {
  it('filtra por status', () => {
    const items = [baseItem({ id: '1', status: 'pendente_aprovacao' }), baseItem({ id: '2', status: 'aprovado' })];
    const result = filterExtraPayments(items, { statuses: ['aprovado'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filtra por categoria', () => {
    const items = [baseItem({ id: '1', category: 'guincho' }), baseItem({ id: '2', category: 'uber' })];
    const result = filterExtraPayments(items, { categories: ['uber'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('sem filtros retorna tudo', () => {
    const items = [baseItem({ id: '1' }), baseItem({ id: '2' })];
    expect(filterExtraPayments(items, {})).toHaveLength(2);
  });
});

describe('computeExtraPaymentCounts', () => {
  it('conta itens por status', () => {
    const items = [
      baseItem({ id: '1', status: 'pendente_aprovacao' }),
      baseItem({ id: '2', status: 'pendente_aprovacao' }),
      baseItem({ id: '3', status: 'aprovado' }),
      baseItem({ id: '4', status: 'pago' }),
      baseItem({ id: '5', status: 'reprovado' }),
      baseItem({ id: '6', status: 'cancelado' }),
    ];

    const counts = computeExtraPaymentCounts(items);

    expect(counts).toEqual({
      pendente_aprovacao: 2,
      aprovado: 1,
      reprovado: 1,
      pago: 1,
      cancelado: 1,
    });
  });
});
