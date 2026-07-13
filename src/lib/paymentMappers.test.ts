import { describe, expect, it } from 'vitest';

import { paymentInstallmentFromRow } from './paymentMappers';

import type { PaymentInstallmentRow } from '../types/payment';

function baseRow(overrides: Partial<PaymentInstallmentRow> = {}): PaymentInstallmentRow {
  return {
    id: 'inst-1',
    maintenance_order_id: 'os-1',
    source_type: 'maintenance_order',
    extra_payment_request_id: null,
    client_id: 'client-1',
    installment_number: 1,
    installments_total: 1,
    value: 1000,
    due_date: '2026-08-01',
    competencia_date: null,
    status: 'pendente_aprovacao',
    payment_method: 'boleto',
    boleto_url: null,
    nota_fiscal_url: null,
    nota_fiscal_url_2: null,
    invoice_number: null,
    pix_key_type: null,
    pix_key: null,
    pix_beneficiary_name: null,
    categoria: null,
    centro_custo: null,
    descricao: null,
    notes: null,
    created_by_id: null,
    payment_approved_by: null,
    payment_approved_at: null,
    paid_by: null,
    paid_at: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    maintenance_orders: null,
    extra_payment_requests: null,
    ...overrides,
  };
}

describe('paymentInstallmentFromRow', () => {
  it('mapeia nota_fiscal_url_2, budget_pdf_url e budget_reviewer.name quando presentes', () => {
    const row = baseRow({
      nota_fiscal_url_2: 'client-1/payments/os-1/nota-2.pdf',
      maintenance_orders: {
        os_number: 'OS-1',
        budget_pdf_url: 'https://public/budget.pdf',
        workshops: null,
        budget_reviewer: { name: 'Fulano Aprovador' },
      },
    });

    const result = paymentInstallmentFromRow(row);

    expect(result.notaFiscalUrl2).toBe('client-1/payments/os-1/nota-2.pdf');
    expect(result.budgetPdfUrl).toBe('https://public/budget.pdf');
    expect(result.budgetApprovedByName).toBe('Fulano Aprovador');
  });

  it('devolve undefined quando os campos vêm nulos/ausentes', () => {
    const row = baseRow();

    const result = paymentInstallmentFromRow(row);

    expect(result.notaFiscalUrl2).toBeUndefined();
    expect(result.budgetPdfUrl).toBeUndefined();
    expect(result.budgetApprovedByName).toBeUndefined();
  });

  it('mapeia invoice_number quando presente', () => {
    const result = paymentInstallmentFromRow(baseRow({ invoice_number: 'NF-123' }));

    expect(result.invoiceNumber).toBe('NF-123');
  });

  it('invoice_number nulo vira undefined', () => {
    const result = paymentInstallmentFromRow(baseRow({ invoice_number: null }));

    expect(result.invoiceNumber).toBeUndefined();
  });

  it('mapeia parcela de manutenção como antes (sourceType maintenance_order)', () => {
    const result = paymentInstallmentFromRow(baseRow());

    expect(result.sourceType).toBe('maintenance_order');
    expect(result.maintenanceOrderId).toBe('os-1');
    expect(result.extraPaymentRequestId).toBeUndefined();
  });

  it('mapeia parcela extra com fornecedor/documento/categoria/aprovador', () => {
    const row = baseRow({
      maintenance_order_id: null,
      source_type: 'extra_payment',
      extra_payment_request_id: 'epr-1',
      extra_payment_requests: {
        request_number: 'PE-2607-0001',
        category: 'guincho',
        supplier_name: 'Guincho Rápido LTDA',
        supplier_document: '12.345.678/0001-90',
        approved_by: 'user-1',
        approved_at: '2026-07-12T10:00:00Z',
        vehicles: { license_plate: 'ABC1D23' },
        drivers: { name: 'João Motorista' },
        approver: { name: 'Coordenador Fulano' },
      },
    });

    const result = paymentInstallmentFromRow(row);

    expect(result.sourceType).toBe('extra_payment');
    expect(result.maintenanceOrderId).toBeUndefined();
    expect(result.extraPaymentRequestId).toBe('epr-1');
    expect(result.extraPaymentNumber).toBe('PE-2607-0001');
    expect(result.extraPaymentCategory).toBe('guincho');
    expect(result.extraPaymentSupplierName).toBe('Guincho Rápido LTDA');
    expect(result.extraPaymentSupplierDocument).toBe('12.345.678/0001-90');
    expect(result.extraPaymentVehiclePlate).toBe('ABC1D23');
    expect(result.extraPaymentDriverName).toBe('João Motorista');
    expect(result.extraPaymentApprovedByName).toBe('Coordenador Fulano');
    expect(result.workshopName).toBe('Guincho Rápido LTDA');
    expect(result.workshopCnpj).toBe('12.345.678/0001-90');
  });
});
