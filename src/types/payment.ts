import type { MaintenanceStatus } from './maintenance';

// ─── Pagamentos (módulo financeiro) ──────────────────────────────────────────

export type PaymentInstallmentStatus = 'pendente_aprovacao' | 'aprovado' | 'reprovado' | 'pago' | 'cancelado';

export type PaymentSourceType = 'maintenance_order' | 'extra_payment';

export type PaymentMethod = 'boleto' | 'pix';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export type InstallmentInterval = 'mensal' | 'quinzenal' | 'semanal';

export interface PaymentInstallment {
  id: string;
  maintenanceOrderId?: string;
  sourceType: PaymentSourceType;
  extraPaymentRequestId?: string;
  clientId: string;
  installmentNumber: number;
  installmentsTotal: number;
  value: number;
  dueDate: string;
  competenciaDate?: string;
  status: PaymentInstallmentStatus;
  paymentMethod: PaymentMethod;
  boletoUrl?: string;
  notaFiscalUrl?: string;
  notaFiscalUrl2?: string;
  invoiceNumber?: string;
  budgetPdfUrl?: string;
  budgetApprovedByName?: string;
  pixKeyType?: PixKeyType;
  pixKey?: string;
  pixBeneficiaryName?: string;
  categoria?: string;
  centroCusto?: string;
  descricao?: string;
  notes?: string;
  createdById?: string;
  paymentApprovedBy?: string;
  paymentApprovedAt?: string;
  paidBy?: string;
  paidAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  // Joins (populated via select with relations)
  workshopName?: string;
  workshopCnpj?: string;
  maintenanceOrderOs?: string;
  maintenanceOrderApprovedCost?: number;
  maintenanceOrderVehiclePlate?: string;
  maintenanceOrderStatus?: MaintenanceStatus;
  // Campos derivados de origem extra (Pagamentos Extras / Serviços Avulsos)
  extraPaymentNumber?: string;
  extraPaymentCategory?: string;
  extraPaymentSupplierName?: string;
  extraPaymentSupplierDocument?: string;
  extraPaymentVehiclePlate?: string;
  extraPaymentDriverName?: string;
  extraPaymentApprovedByName?: string;
  extraPaymentApprovedBy?: string;
}

export interface PaymentInstallmentRow {
  id: string;
  maintenance_order_id: string | null;
  source_type: PaymentSourceType;
  extra_payment_request_id: string | null;
  client_id: string;
  installment_number: number;
  installments_total: number;
  value: number;
  due_date: string;
  competencia_date: string | null;
  status: PaymentInstallmentStatus;
  payment_method: PaymentMethod;
  boleto_url: string | null;
  nota_fiscal_url: string | null;
  nota_fiscal_url_2: string | null;
  invoice_number: string | null;
  pix_key_type: PixKeyType | null;
  pix_key: string | null;
  pix_beneficiary_name: string | null;
  categoria: string | null;
  centro_custo: string | null;
  descricao: string | null;
  notes: string | null;
  created_by_id: string | null;
  payment_approved_by: string | null;
  payment_approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  maintenance_orders?: {
    os_number: string;
    status?: MaintenanceStatus | null;
    budget_pdf_url: string | null;
    approved_cost: number | null;
    workshops: { name: string; cnpj: string | null } | null;
    vehicles: { license_plate: string } | null;
    budget_reviewer: { name: string } | null;
  } | null;
  extra_payment_requests?: {
    request_number: string;
    category: string;
    supplier_name: string;
    supplier_document: string | null;
    approved_by: string | null;
    approved_at: string | null;
    vehicles: { license_plate: string } | null;
    drivers: { name: string } | null;
    approver: { name: string } | null;
  } | null;
}

export interface PaymentInstallmentAuditors {
  budgetApprovedByName?: string;
  paymentApprovedByName?: string;
  paidByName?: string;
  cancelledByName?: string;
}

export interface PaymentApprovalSnapshot {
  id: string;
  updatedAt: string;
}

export interface PaymentApprovalResult {
  approvedCount: number;
  approvedIds: string[];
}

export interface InstallmentDraft {
  installmentNumber: number;
  value: number;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  pixKeyType?: PixKeyType;
  pixKey?: string;
  pixBeneficiaryName?: string;
  boletoUrl?: string;
}
