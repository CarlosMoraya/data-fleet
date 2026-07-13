import { describe, expect, it } from 'vitest';

import { buildPaymentPendingQueue } from './paymentPendingDocs';

import type { PaymentInstallment } from '../types/payment';

function makeInstallment(
  overrides: Partial<PaymentInstallment> = {},
): PaymentInstallment {
  return {
    id: 'i1',
    maintenanceOrderId: 'mo-1',
    sourceType: 'maintenance_order',
    clientId: 'c1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 1000,
    dueDate: '2026-02-15',
    status: 'pendente_aprovacao',
    paymentMethod: 'boleto',
    boletoUrl: 'storage/path.pdf',
    pixKey: 'chave-pix',
    pixBeneficiaryName: 'Fornecedor X',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    maintenanceOrderOs: 'OS-001',
    ...overrides,
  };
}

describe('buildPaymentPendingQueue', () => {
  it('lista vazia → sem itens', () => {
    expect(buildPaymentPendingQueue([])).toEqual([]);
  });

  it('parcela completa com boleto NÃO entra na fila', () => {
    const items = buildPaymentPendingQueue([makeInstallment()]);
    expect(items).toEqual([]);
  });

  it('boleto sem boleto_url entra na fila', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({ paymentMethod: 'boleto', boletoUrl: undefined }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(1);
    expect(items[0].severity).toBe('medium');
    expect(items[0].label).toBe('Parcelas sem dados de pagamento');
    expect(items[0].details).toHaveLength(1);
  });

  it('parcela aprovada sem boleto_url NÃO entra na fila', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({ status: 'aprovado', paymentMethod: 'boleto', boletoUrl: undefined }),
    ]);

    expect(items).toEqual([]);
  });

  it('parcela paga sem dados NÃO entra na fila', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({
        status: 'pago',
        paymentMethod: 'pix',
        pixKey: undefined,
        pixBeneficiaryName: undefined,
      }),
    ]);

    expect(items).toEqual([]);
  });

  it('pix sem pix_key entra na fila', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({ paymentMethod: 'pix', pixKey: undefined }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(1);
  });

  it('pix sem pix_beneficiary_name entra na fila', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({
        paymentMethod: 'pix',
        pixKey: 'chave',
        pixBeneficiaryName: undefined,
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(1);
  });

  it('pix completo NÃO entra na fila', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({
        paymentMethod: 'pix',
        pixKey: 'chave',
        pixBeneficiaryName: 'Fornecedor X',
      }),
    ]);
    expect(items).toEqual([]);
  });

  it('agrupa múltiplas pendências em um único item com count e details corretos', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({ id: 'a', installmentsTotal: 3, installmentNumber: 1, boletoUrl: undefined }),
      makeInstallment({ id: 'b', installmentsTotal: 3, installmentNumber: 2, paymentMethod: 'pix', pixKey: undefined }),
      makeInstallment({ id: 'c', installmentsTotal: 3, installmentNumber: 3 }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(2);
    expect(items[0].details).toHaveLength(2);
    // detalhe referencia número da parcela e OS
    expect(items[0].details.join(' ')).toContain('#1/3');
    expect(items[0].details.join(' ')).toContain('#2/3');
  });

  it('fila usa número de extra quando origem for extra_payment', () => {
    const items = buildPaymentPendingQueue([
      makeInstallment({
        sourceType: 'extra_payment',
        maintenanceOrderId: undefined,
        maintenanceOrderOs: undefined,
        extraPaymentNumber: 'PE-2607-0001',
        boletoUrl: undefined,
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].details[0]).toContain('PE-2607-0001');
  });
});
