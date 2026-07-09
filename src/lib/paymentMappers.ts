import type { PaymentInstallment, PaymentInstallmentRow } from '../types/payment';

/**
 * Presentation Mapper: converte a row snake_case (+ joins) da tabela
 * `payment_installments` para o objeto camelCase consumido pela UI.
 */
export function paymentInstallmentFromRow(row: PaymentInstallmentRow): PaymentInstallment {
  return {
    id: row.id,
    maintenanceOrderId: row.maintenance_order_id,
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
    workshopName: row.maintenance_orders?.workshops?.name ?? undefined,
    workshopCnpj: row.maintenance_orders?.workshops?.cnpj ?? undefined,
    maintenanceOrderOs: row.maintenance_orders?.os_number ?? undefined,
  };
}
