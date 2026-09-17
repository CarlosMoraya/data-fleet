import { describe, expect, it } from 'vitest';

import { getNextPaymentInstallmentSort, sortPaymentInstallments } from './paymentInstallmentSort';

import type { PaymentInstallment } from '../types/payment';

function row(id: string, dueDate: string, competenciaDate?: string): PaymentInstallment {
  return { id, dueDate, competenciaDate } as PaymentInstallment;
}
const ids = (list: PaymentInstallment[]) => list.map((i) => i.id);

const A = row('a', '2026-09-10', '2026-08-01');
const B = row('b', '2026-08-05', undefined);
const C = row('c', '2026-10-01', '2026-07-15');
const D = row('d', '2026-08-05', '2026-08-01');
const input = [A, B, C, D];

describe('sortPaymentInstallments', () => {
  it('sem ordenacao devolve copia nova na mesma ordem', () => {
    const result = sortPaymentInstallments(input, null);
    expect(ids(result)).toEqual(['a', 'b', 'c', 'd']);
    expect(result).not.toBe(input);
  });

  it('ordena por dueDate asc', () => {
    const result = sortPaymentInstallments(input, { key: 'dueDate', direction: 'asc' });
    expect(ids(result)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('ordena por dueDate desc', () => {
    const result = sortPaymentInstallments(input, { key: 'dueDate', direction: 'desc' });
    expect(ids(result)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ordena por competenciaDate asc', () => {
    const result = sortPaymentInstallments(input, { key: 'competenciaDate', direction: 'asc' });
    expect(ids(result)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('ordena por competenciaDate desc', () => {
    const result = sortPaymentInstallments(input, { key: 'competenciaDate', direction: 'desc' });
    expect(ids(result)).toEqual(['a', 'd', 'c', 'b']);
  });

  it('string vazia e ausente', () => {
    const list = [row('e', '2026-08-01', ''), C];
    expect(ids(sortPaymentInstallments(list, { key: 'competenciaDate', direction: 'asc' }))).toEqual(['c', 'e']);
    expect(ids(sortPaymentInstallments(list, { key: 'competenciaDate', direction: 'desc' }))).toEqual(['c', 'e']);
  });

  it('nao muta a entrada', () => {
    sortPaymentInstallments(input, { key: 'dueDate', direction: 'asc' });
    expect(ids(input)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ciclo de ordenacao', () => {
    expect(getNextPaymentInstallmentSort(null, 'dueDate')).toEqual({ key: 'dueDate', direction: 'asc' });
    expect(getNextPaymentInstallmentSort({ key: 'dueDate', direction: 'asc' }, 'dueDate')).toEqual({
      key: 'dueDate',
      direction: 'desc',
    });
    expect(getNextPaymentInstallmentSort({ key: 'dueDate', direction: 'desc' }, 'dueDate')).toEqual({
      key: 'dueDate',
      direction: 'asc',
    });
    expect(getNextPaymentInstallmentSort({ key: 'dueDate', direction: 'desc' }, 'competenciaDate')).toEqual({
      key: 'competenciaDate',
      direction: 'asc',
    });
  });
});
