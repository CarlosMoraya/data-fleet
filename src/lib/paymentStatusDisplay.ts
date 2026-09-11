import type { PaymentInstallmentStatus } from '../types/payment';
import type { ExtraPaymentStatus } from '../types/serviceExpense';

export const PAYMENT_INSTALLMENT_STATUS_LABELS: Record<PaymentInstallmentStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Lançado no sistema',
};

export const EXTRA_PAYMENT_STATUS_LABELS: Record<ExtraPaymentStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Lançado no sistema',
  cancelado: 'Cancelado',
};
