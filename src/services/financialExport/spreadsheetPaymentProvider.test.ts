import { describe, expect, it } from 'vitest';

import { SpreadsheetPaymentProvider } from './spreadsheetPaymentProvider';

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

describe('SpreadsheetPaymentProvider — metadados', () => {
  const provider = new SpreadsheetPaymentProvider();

  it('tem code "planilha"', () => {
    expect(provider.code).toBe('planilha');
  });

  it('expõe name e description', () => {
    expect(provider.name).toBe('Planilha');
    expect(provider.description).toBeTruthy();
  });
});

describe('SpreadsheetPaymentProvider — CSV', () => {
  const provider = new SpreadsheetPaymentProvider();

  it('gera cabeçalho com as 10 colunas na ordem exata', async () => {
    const result = await provider.exportData('c1', [makeInstallment()]);

    const firstLine = result.content!.split('\r\n')[0];
    expect(firstLine).toBe(
      'Data de Competência,Data de Vencimento,Data de Pagamento,Valor,Categoria,Descrição,Cliente/Fornecedor,CNPJ/CPF Cliente/Fornecedor,Centro de Custo,Observações',
    );
  });

  it('mapeia Data de Pagamento = due_date (vencimento da fatura)', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({ dueDate: '2026-02-15', competenciaDate: '2026-01-31' }),
    ]);

    const line = result.content!.split('\r\n')[1];
    const cells = line.split(',');
    expect(cells[0]).toBe('31/01/2026'); // Data de Competência
    expect(cells[1]).toBe('15/02/2026'); // Data de Vencimento
    expect(cells[2]).toBe('15/02/2026'); // Data de Pagamento = vencimento
  });

  it('formata Valor em pt-BR (separador de milhar "." e decimal ",")', async () => {
    const result = await provider.exportData('c1', [makeInstallment({ value: 5000 })]);

    const line = result.content!.split('\r\n')[1];
    expect(line).toContain('"5.000,00"');
  });

  it('formata valores grandes e fracionados', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({ id: 'p1', value: 1234567.89 }),
      makeInstallment({ id: 'p2', value: 6666.66 }),
    ]);

    const lines = result.content!.split('\r\n');
    expect(lines[1]).toContain('"1.234.567,89"');
    expect(lines[2]).toContain('"6.666,66"');
  });

  it('faz escaping de vírgula e aspas', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({ descricao: 'Pastilha, pastão "especial"' }),
    ]);

    const line = result.content!.split('\r\n')[1];
    expect(line).toContain('"Pastilha, pastão ""especial"""');
  });

  it('recordsSent == número de parcelas e success=true', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({ id: 'p1' }),
      makeInstallment({ id: 'p2' }),
    ]);

    expect(result.success).toBe(true);
    expect(result.recordsSent).toBe(2);
  });

  it('gera uma linha de dados por parcela + cabeçalho', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({ id: 'p1' }),
      makeInstallment({ id: 'p2' }),
      makeInstallment({ id: 'p3' }),
    ]);

    const lines = result.content!.split('\r\n');
    expect(lines).toHaveLength(4); // 1 header + 3 parcelas
  });

  it('exporta Cliente/Fornecedor, CNPJ/CPF e Observações nas colunas corretas', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({
        value: 100,
        categoria: 'Cat',
        descricao: 'Desc',
        workshopName: 'Oficina X',
        workshopCnpj: '12.345.678/0001-00',
        centroCusto: 'CC',
        notes: 'Pago com desconto',
      }),
    ]);

    const line = result.content!.split('\r\n')[1];
    expect(line).toBe(
      '31/01/2026,15/02/2026,15/02/2026,"100,00",Cat,Desc,Oficina X,12.345.678/0001-00,CC,Pago com desconto',
    );
  });

  it('deixa cells vazias quando campos opcionais estão ausentes', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({
        competenciaDate: undefined,
        categoria: undefined,
        centroCusto: undefined,
        notes: undefined,
        workshopName: undefined,
        workshopCnpj: undefined,
      }),
    ]);

    const line = result.content!.split('\r\n')[1];
    // Nada de "undefined"/"null" literal vazando para o CSV.
    expect(line).not.toContain('undefined');
    expect(line).not.toContain('null');
    // Primeiro cell (Competência) vazio → linha começa com vírgula; Valor continua formatado e quotado.
    expect(line.startsWith(',')).toBe(true);
    expect(line).toContain('"5.000,00"');
  });

  it('CSV de extra usa fornecedor/documento/categoria do extra', async () => {
    const result = await provider.exportData('c1', [
      makeInstallment({
        maintenanceOrderId: undefined,
        sourceType: 'extra_payment',
        extraPaymentRequestId: 'epr-1',
        extraPaymentCategory: 'guincho',
        extraPaymentSupplierName: 'Guincho Rápido LTDA',
        extraPaymentSupplierDocument: '12.345.678/0001-90',
        workshopName: undefined,
        workshopCnpj: undefined,
        categoria: undefined,
      }),
    ]);

    const line = result.content!.split('\r\n')[1];
    expect(line).toContain('guincho');
    expect(line).toContain('Guincho Rápido LTDA');
    expect(line).toContain('12.345.678/0001-90');
  });
});
