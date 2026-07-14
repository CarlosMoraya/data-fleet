import { describe, expect, it } from 'vitest';

import { buildPaymentTemplateCells, PAYMENT_TEMPLATE_HEADERS } from './paymentTemplateRows';

import type { PaymentInstallment } from '../../types/payment';

function makeInstallment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'p1',
    maintenanceOrderId: 'mo-1',
    sourceType: 'maintenance_order',
    clientId: 'c1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 5000,
    dueDate: '2026-02-15',
    competenciaDate: '2026-01-31',
    status: 'pago',
    paymentMethod: 'boleto',
    workshopName: 'Oficina Auto Center',
    workshopCnpj: '12.345.678/0001-90',
    categoria: 'Manutenção',
    descricao: 'Troca de pastilhas',
    centroCusto: 'Frota SP',
    notes: 'Pagamento via boleto',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('PAYMENT_TEMPLATE_HEADERS', () => {
  it('tem as 10 colunas na ordem exata do template', () => {
    expect(PAYMENT_TEMPLATE_HEADERS).toEqual([
      'Data de Competência',
      'Data de Vencimento',
      'Data de Pagamento',
      'Valor',
      'Categoria',
      'Descrição',
      'Cliente/Fornecedor',
      'CNPJ/CPF Cliente/Fornecedor',
      'Centro de Custo',
      'Observações',
    ]);
  });
});

describe('buildPaymentTemplateCells', () => {
  it('retorna as 10 células na ordem correta, com datas e valor formatados', () => {
    const cells = buildPaymentTemplateCells(makeInstallment());
    expect(cells).toHaveLength(10);
    expect(cells[0]).toBe('31/01/2026'); // Data de Competência
    expect(cells[1]).toBe('15/02/2026'); // Data de Vencimento
    expect(cells[2]).toBe('15/02/2026'); // Data de Pagamento = vencimento
    expect(cells[3]).toBe('5.000,00'); // Valor
    expect(cells[4]).toBe('Manutenção'); // Categoria
    expect(cells[5]).toBe('Troca de pastilhas'); // Descrição
    expect(cells[6]).toBe('Oficina Auto Center'); // Cliente/Fornecedor
    expect(cells[7]).toBe('12.345.678/0001-90'); // CNPJ/CPF
    expect(cells[8]).toBe('Frota SP'); // Centro de Custo
    expect(cells[9]).toBe('Pagamento via boleto'); // Observações
  });

  it('usa fallback de origem extra (extraPaymentCategory/extraPaymentSupplierName/extraPaymentSupplierDocument)', () => {
    const cells = buildPaymentTemplateCells(makeInstallment({
      maintenanceOrderId: undefined,
      sourceType: 'extra_payment',
      extraPaymentRequestId: 'epr-1',
      extraPaymentCategory: 'guincho',
      extraPaymentSupplierName: 'Guincho Rápido LTDA',
      extraPaymentSupplierDocument: '12.345.678/0001-90',
      workshopName: undefined,
      workshopCnpj: undefined,
      categoria: undefined,
    }));
    expect(cells[4]).toBe('guincho');
    expect(cells[6]).toBe('Guincho Rápido LTDA');
    expect(cells[7]).toBe('12.345.678/0001-90');
  });

  it('retorna células vazias para campos opcionais ausentes, sem "undefined"/"null" literal', () => {
    const cells = buildPaymentTemplateCells(makeInstallment({
      competenciaDate: undefined,
      categoria: undefined,
      centroCusto: undefined,
      notes: undefined,
      workshopName: undefined,
      workshopCnpj: undefined,
    }));
    expect(cells[0]).toBe('');
    expect(cells.join('|')).not.toContain('undefined');
    expect(cells.join('|')).not.toContain('null');
  });
});
