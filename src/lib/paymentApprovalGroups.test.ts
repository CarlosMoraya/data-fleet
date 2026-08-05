import { describe, expect, it } from 'vitest';

import { groupPendingMaintenancePayments } from './paymentApprovalGroups';

import type { PaymentInstallment } from '../types/payment';

function installment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'inst-1',
    maintenanceOrderId: 'os-1',
    sourceType: 'maintenance_order',
    clientId: 'client-1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 100,
    dueDate: '2026-08-01',
    status: 'pendente_aprovacao',
    paymentMethod: 'boleto',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    maintenanceOrderOs: 'OS-0001',
    workshopName: 'Oficina A',
    ...overrides,
  };
}

describe('groupPendingMaintenancePayments', () => {
  it('agrupa múltiplas parcelas da mesma OS em um único grupo', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', installmentNumber: 1 }),
      installment({ id: 'i2', installmentNumber: 2 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].maintenanceOrderId).toBe('os-1');
    expect(groups[0].installmentCount).toBe(2);
  });

  it('OS diferentes geram grupos separados', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', maintenanceOrderId: 'os-1', createdAt: '2026-07-01T00:00:00Z' }),
      installment({ id: 'i2', maintenanceOrderId: 'os-2', createdAt: '2026-07-02T00:00:00Z' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.maintenanceOrderId).sort()).toEqual(['os-1', 'os-2']);
  });

  it('descarta parcelas de origem extra_payment', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', sourceType: 'extra_payment', maintenanceOrderId: undefined, extraPaymentRequestId: 'epr-1' }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('descarta parcelas que não estão pendentes', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', status: 'aprovado' }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('descarta registros sem maintenanceOrderId', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', maintenanceOrderId: undefined }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('ordena parcelas dentro do grupo por installmentNumber, desempatando por dueDate', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i2', installmentNumber: 2, dueDate: '2026-08-10' }),
      installment({ id: 'i1a', installmentNumber: 1, dueDate: '2026-08-05' }),
      installment({ id: 'i1b', installmentNumber: 1, dueDate: '2026-08-01' }),
    ]);

    expect(groups[0].installments.map((i) => i.id)).toEqual(['i1b', 'i1a', 'i2']);
  });

  it('soma em centavos evita resíduo de float', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', value: 0.1 }),
      installment({ id: 'i2', installmentNumber: 2, value: 0.2 }),
    ]);

    expect(groups[0].totalPending).toBe(0.3);
  });

  it('ordena grupos pelo oldestCreatedAt', () => {
    const groups = groupPendingMaintenancePayments([
      installment({ id: 'i1', maintenanceOrderId: 'os-later', createdAt: '2026-07-05T00:00:00Z' }),
      installment({ id: 'i2', maintenanceOrderId: 'os-earlier', createdAt: '2026-07-01T00:00:00Z' }),
    ]);

    expect(groups.map((g) => g.maintenanceOrderId)).toEqual(['os-earlier', 'os-later']);
  });
});
