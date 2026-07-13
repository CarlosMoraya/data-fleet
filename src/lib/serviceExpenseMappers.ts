import type {
  ExtraPaymentFormInput,
  ExtraPaymentRequest,
  ExtraPaymentRequestRow,
} from '../types/serviceExpense';

/**
 * Presentation Mapper: converte a row snake_case (+ joins) da tabela
 * `extra_payment_requests` para o objeto camelCase consumido pela UI.
 */
export function extraPaymentRequestFromRow(row: ExtraPaymentRequestRow): ExtraPaymentRequest {
  return {
    id: row.id,
    clientId: row.client_id,
    requestNumber: row.request_number,
    category: row.category,
    serviceDate: row.service_date,
    supplierName: row.supplier_name,
    supplierDocument: row.supplier_document ?? undefined,
    vehicleId: row.vehicle_id ?? undefined,
    driverId: row.driver_id ?? undefined,
    amount: Number(row.amount),
    description: row.description ?? undefined,
    justification: row.justification ?? undefined,
    notes: row.notes ?? undefined,
    receiptUrl: row.receipt_url ?? undefined,
    invoiceUrl: row.invoice_url ?? undefined,
    status: row.status,
    createdById: row.created_by_id,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    paidBy: row.paid_by ?? undefined,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicleLicensePlate: row.vehicles?.license_plate ?? undefined,
    driverName: row.drivers?.name ?? undefined,
    approvedByName: row.approver?.name ?? undefined,
  };
}

/**
 * Normaliza o payload de criação de um Pagamento Extra. Status sempre nasce
 * `pendente_aprovacao`, independente do que vier no formulário.
 */
export function extraPaymentRequestToInsert(
  input: ExtraPaymentFormInput,
  clientId: string,
  userId: string,
  requestNumber: string,
): Record<string, unknown> {
  return {
    client_id: clientId,
    request_number: requestNumber,
    category: input.category,
    service_date: input.serviceDate,
    supplier_name: input.supplierName,
    supplier_document: input.supplierDocument ?? null,
    vehicle_id: input.vehicleId ?? null,
    driver_id: input.driverId ?? null,
    amount: input.amount,
    description: input.description ?? null,
    justification: input.justification ?? null,
    notes: input.notes ?? null,
    receipt_url: input.receiptUrl ?? null,
    invoice_url: input.invoiceUrl ?? null,
    status: 'pendente_aprovacao',
    created_by_id: userId,
  };
}
