import { describe, expect, it } from 'vitest';

import { paymentInstallmentFromRow } from './paymentMappers';

import type { PaymentInstallmentRow } from '../types/payment';

function baseRow(overrides: Partial<PaymentInstallmentRow> = {}): PaymentInstallmentRow {
  return {
    id: 'inst-1',
    maintenance_order_id: 'os-1',
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
});
