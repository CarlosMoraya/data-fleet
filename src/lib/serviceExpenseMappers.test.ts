import { describe, expect, it } from 'vitest';

import { extraPaymentRequestFromRow, extraPaymentRequestToInsert } from './serviceExpenseMappers';

import type { ExtraPaymentFormInput, ExtraPaymentRequestRow } from '../types/serviceExpense';

function baseRow(overrides: Partial<ExtraPaymentRequestRow> = {}): ExtraPaymentRequestRow {
  return {
    id: 'epr-1',
    client_id: 'client-1',
    request_number: 'PE-2607-0001',
    category: 'guincho',
    service_date: '2026-07-10',
    supplier_name: 'Guincho Rápido LTDA',
    supplier_document: null,
    vehicle_id: null,
    driver_id: null,
    amount: 350,
    description: null,
    justification: null,
    notes: null,
    receipt_url: null,
    invoice_url: null,
    evidence_urls: null,
    status: 'pendente_aprovacao',
    created_by_id: 'user-1',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    paid_by: null,
    paid_at: null,
    created_at: '2026-07-10T00:00:00Z',
    updated_at: '2026-07-10T00:00:00Z',
    vehicles: null,
    drivers: null,
    approver: null,
    ...overrides,
  };
}

describe('extraPaymentRequestFromRow', () => {
  it('mapeia joins de vehicles(license_plate) e drivers(name)', () => {
    const row = baseRow({
      vehicle_id: 'vehicle-1',
      driver_id: 'driver-1',
      vehicles: { license_plate: 'ABC1D23' },
      drivers: { name: 'João Motorista' },
    });

    const result = extraPaymentRequestFromRow(row);

    expect(result.vehicleLicensePlate).toBe('ABC1D23');
    expect(result.driverName).toBe('João Motorista');
  });

  it('campos nulos viram undefined', () => {
    const result = extraPaymentRequestFromRow(baseRow());

    expect(result.supplierDocument).toBeUndefined();
    expect(result.vehicleId).toBeUndefined();
    expect(result.driverId).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.justification).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.receiptUrl).toBeUndefined();
    expect(result.invoiceUrl).toBeUndefined();
    expect(result.approvedBy).toBeUndefined();
    expect(result.vehicleLicensePlate).toBeUndefined();
    expect(result.driverName).toBeUndefined();
    expect(result.approvedByName).toBeUndefined();
  });

  it('converte amount para number', () => {
    const result = extraPaymentRequestFromRow(baseRow({ amount: '350.50' as unknown as number }));

    expect(result.amount).toBe(350.5);
  });

  it('mapeia evidence_urls com 2 caminhos', () => {
    const result = extraPaymentRequestFromRow(
      baseRow({ evidence_urls: ['a/b.jpg', 'c/d.jpg'] }),
    );

    expect(result.evidenceUrls).toEqual(['a/b.jpg', 'c/d.jpg']);
  });

  it('evidence_urls nulo vira undefined', () => {
    const result = extraPaymentRequestFromRow(baseRow({ evidence_urls: null }));

    expect(result.evidenceUrls).toBeUndefined();
  });
});

describe('extraPaymentRequestToInsert', () => {
  const input: ExtraPaymentFormInput = {
    category: 'guincho',
    serviceDate: '2026-07-10',
    supplierName: 'Guincho Rápido LTDA',
    amount: 350,
  };

  it('payload de insert nunca aceita status informado pelo usuário; sempre pendente_aprovacao', () => {
    const result = extraPaymentRequestToInsert(
      { ...input, ...({ status: 'aprovado' } as unknown as ExtraPaymentFormInput) },
      'client-1',
      'user-1',
      'PE-2607-0001',
    );

    expect(result.status).toBe('pendente_aprovacao');
  });

  it('monta payload com client_id, created_by_id e request_number recebidos por parâmetro', () => {
    const result = extraPaymentRequestToInsert(input, 'client-1', 'user-1', 'PE-2607-0001');

    expect(result).toMatchObject({
      client_id: 'client-1',
      created_by_id: 'user-1',
      request_number: 'PE-2607-0001',
      category: 'guincho',
      service_date: '2026-07-10',
      supplier_name: 'Guincho Rápido LTDA',
      amount: 350,
      vehicle_id: null,
      driver_id: null,
    });
  });

  it('sem evidenceUrls, grava evidence_urls: null', () => {
    const result = extraPaymentRequestToInsert(input, 'client-1', 'user-1', 'PE-2607-0001');

    expect(result.evidence_urls).toBeNull();
  });

  it('com 3 caminhos, grava o array com os 3', () => {
    const result = extraPaymentRequestToInsert(
      { ...input, evidenceUrls: ['a.jpg', 'b.jpg', 'c.jpg'] },
      'client-1',
      'user-1',
      'PE-2607-0001',
    );

    expect(result.evidence_urls).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });
});
