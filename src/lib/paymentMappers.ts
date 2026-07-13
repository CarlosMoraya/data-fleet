import type { PaymentInstallment, PaymentInstallmentRow } from '../types/payment';

/**
 * Presentation Mapper: converte a row snake_case (+ joins) da tabela
 * `payment_installments` para o objeto camelCase consumido pela UI.
 */
export function paymentInstallmentFromRow(row: PaymentInstallmentRow): PaymentInstallment {
  return {
    id: row.id,
    maintenanceOrderId: row.maintenance_order_id ?? undefined,
    sourceType: row.source_type,
    extraPaymentRequestId: row.extra_payment_request_id ?? undefined,
    clientId: row.client_id,
    installmentNumber: row.installment_number,
    installmentsTotal: row.installments_total,
    value: Number(row.value),
    dueDate: row.due_date,
    competenciaDate: row.competencia_date ?? undefined,
    status: row.status,
    paymentMethod: row.payment_method,
    boletoUrl: row.boleto_url ?? undefined,
    notaFiscalUrl: row.nota_fiscal_url ?? undefined,
    notaFiscalUrl2: row.nota_fiscal_url_2 ?? undefined,
    invoiceNumber: row.invoice_number ?? undefined,
    budgetPdfUrl: row.maintenance_orders?.budget_pdf_url ?? undefined,
    budgetApprovedByName: row.maintenance_orders?.budget_reviewer?.name ?? undefined,
    pixKeyType: row.pix_key_type ?? undefined,
    pixKey: row.pix_key ?? undefined,
    pixBeneficiaryName: row.pix_beneficiary_name ?? undefined,
    categoria: row.categoria ?? undefined,
    centroCusto: row.centro_custo ?? undefined,
    descricao: row.descricao ?? undefined,
    notes: row.notes ?? undefined,
    createdById: row.created_by_id ?? undefined,
    paymentApprovedBy: row.payment_approved_by ?? undefined,
    paymentApprovedAt: row.payment_approved_at ?? undefined,
    paidBy: row.paid_by ?? undefined,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workshopName: row.maintenance_orders?.workshops?.name ?? row.extra_payment_requests?.supplier_name ?? undefined,
    workshopCnpj:
      row.maintenance_orders?.workshops?.cnpj ?? row.extra_payment_requests?.supplier_document ?? undefined,
    maintenanceOrderOs: row.maintenance_orders?.os_number ?? undefined,
    extraPaymentNumber: row.extra_payment_requests?.request_number ?? undefined,
    extraPaymentCategory: row.extra_payment_requests?.category ?? undefined,
    extraPaymentSupplierName: row.extra_payment_requests?.supplier_name ?? undefined,
    extraPaymentSupplierDocument: row.extra_payment_requests?.supplier_document ?? undefined,
    extraPaymentVehiclePlate: row.extra_payment_requests?.vehicles?.license_plate ?? undefined,
    extraPaymentDriverName: row.extra_payment_requests?.drivers?.name ?? undefined,
    extraPaymentApprovedByName: row.extra_payment_requests?.approver?.name ?? undefined,
  };
}
