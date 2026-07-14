import { describe, expect, it } from 'vitest';

import { selectInstallmentsForVisibleRequests } from './extraPaymentExportSelection';

import type { PaymentInstallment } from '../types/payment';

function makeInstallment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'p1',
    maintenanceOrderId: undefined,
    sourceType: 'extra_payment',
    clientId: 'c1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 100,
    dueDate: '2026-02-15',
    competenciaDate: undefined,
    status: 'pago',
    paymentMethod: 'boleto',
    workshopName: undefined,
    workshopCnpj: undefined,
    categoria: undefined,
    descricao: 'Guincho',
    centroCusto: undefined,
    notes: undefined,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('selectInstallmentsForVisibleRequests', () => {
  it('retorna apenas as parcelas cujo extraPaymentRequestId está em visibleRequestIds', () => {
    const installments = [
      makeInstallment({ id: 'p1', extraPaymentRequestId: 'r1' }),
      makeInstallment({ id: 'p2', extraPaymentRequestId: 'r2' }),
      makeInstallment({ id: 'p3', extraPaymentRequestId: 'r3' }),
    ];
    const result = selectInstallmentsForVisibleRequests(installments, new Set(['r1', 'r2']));
    expect(result.map(i => i.id)).toEqual(['p1', 'p2']);
  });

  it('descarta parcela com extraPaymentRequestId undefined', () => {
    const installments = [
      makeInstallment({ id: 'p1', extraPaymentRequestId: undefined }),
      makeInstallment({ id: 'p2', extraPaymentRequestId: 'r2' }),
    ];
    const result = selectInstallmentsForVisibleRequests(installments, new Set(['r2']));
    expect(result.map(i => i.id)).toEqual(['p2']);
  });

  it('retorna array vazio quando visibleRequestIds está vazio', () => {
    const installments = [makeInstallment({ id: 'p1', extraPaymentRequestId: 'r1' })];
    const result = selectInstallmentsForVisibleRequests(installments, new Set());
    expect(result).toEqual([]);
  });
});
