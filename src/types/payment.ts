// ─── Pagamentos (módulo financeiro) ──────────────────────────────────────────

export type PaymentInstallmentStatus = 'pendente_aprovacao' | 'aprovado' | 'reprovado' | 'pago';

export type PaymentMethod = 'boleto' | 'pix';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export type InstallmentInterval = 'mensal' | 'quinzenal' | 'semanal';

export interface PaymentInstallment {
  id: string;
  maintenanceOrderId: string;
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
  createdAt: string;
  updatedAt: string;
  // Joins (populated via select with relations)
  workshopName?: string;
  workshopCnpj?: string;
  maintenanceOrderOs?: string;
}

export interface PaymentInstallmentRow {
  id: string;
  maintenance_order_id: string;
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
  created_at: string;
  updated_at: string;
  // Joins
  maintenance_orders?: {
    os_number: string;
    budget_pdf_url: string | null;
    workshops: { name: string; cnpj: string | null } | null;
    budget_reviewer: { name: string } | null;
  } | null;
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
