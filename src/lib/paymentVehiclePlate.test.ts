import { describe, expect, it } from 'vitest';

import { resolvePaymentVehiclePlate } from './paymentVehiclePlate';

import type { PaymentInstallment } from '../types/payment';

function installment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'installment-1',
    maintenanceOrderId: 'order-1',
    sourceType: 'maintenance_order',
    clientId: 'client-1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 500,
    dueDate: '2026-09-10',
    status: 'aprovado',
    paymentMethod: 'boleto',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('resolvePaymentVehiclePlate', () => {
  it('resolve a placa de uma parcela de manutenção', () => {
    expect(resolvePaymentVehiclePlate(installment({
      maintenanceOrderVehiclePlate: 'ABC1D23',
    }))).toBe('ABC1D23');
  });

  it('resolve a placa de uma parcela extra', () => {
    expect(resolvePaymentVehiclePlate(installment({
      sourceType: 'extra_payment',
      maintenanceOrderId: undefined,
      extraPaymentVehiclePlate: 'XYZ9K88',
    }))).toBe('XYZ9K88');
  });

  it('devolve undefined quando não há placa', () => {
    expect(resolvePaymentVehiclePlate(installment())).toBeUndefined();
  });
});
