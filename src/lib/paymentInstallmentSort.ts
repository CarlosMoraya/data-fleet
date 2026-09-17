import type { PaymentInstallment } from '../types/payment';

export type PaymentInstallmentSortKey = 'competenciaDate' | 'dueDate';
export type SortDirection = 'asc' | 'desc';
export interface PaymentInstallmentSort {
  key: PaymentInstallmentSortKey;
  direction: SortDirection;
}

export function sortPaymentInstallments(
  installments: readonly PaymentInstallment[],
  sort: PaymentInstallmentSort | null,
): PaymentInstallment[] {
  if (sort === null) {
    return [...installments];
  }

  return [...installments].sort((a, b) => {
    const aValue = a[sort.key];
    const bValue = b[sort.key];

    if (aValue === undefined || aValue === null || aValue === '') {
      if (bValue === undefined || bValue === null || bValue === '') return 0;
      return 1;
    }
    if (bValue === undefined || bValue === null || bValue === '') return -1;

    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sort.direction === 'desc' ? -comparison : comparison;
  });
}

export function getNextPaymentInstallmentSort(
  current: PaymentInstallmentSort | null,
  key: PaymentInstallmentSortKey,
): PaymentInstallmentSort {
  if (current === null || current.key !== key) {
    return { key, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { key, direction: 'desc' };
  }
  return { key, direction: 'asc' };
}
