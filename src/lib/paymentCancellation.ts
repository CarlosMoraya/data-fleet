import { canCreateExtraPayments } from './rolePermissions';

import type { PaymentInstallment } from '../types/payment';
import type { Role } from '../types/role';
import type { ExtraPaymentRequest } from '../types/serviceExpense';

export const CANCELLATION_REASON_MAX_LENGTH = 500;
export const CANCELLATION_REASON_INVALID_MESSAGE =
  'Informe um motivo de cancelamento com até 500 caracteres.';
export const CANCELLATION_NOT_APPLIED_MESSAGE =
  'Não foi possível cancelar: o pagamento foi alterado ou você não tem permissão. Atualize a tela e tente novamente.';
export const EXTRA_PAYMENT_INSTALLMENT_CANCEL_HINT =
  'Para cancelar esta parcela, cancele o pagamento extra na aba Pagamentos Extras.';
export const CANCELLATION_IRREVERSIBLE_WARNING =
  'O cancelamento é definitivo e não estorna valores. Se este pagamento já foi feito no banco, trate o estorno fora do sistema.';

export function normalizeCancellationReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > CANCELLATION_REASON_MAX_LENGTH) return null;
  return trimmed;
}

export function canCancelExtraPaymentRequest(
  request: Pick<ExtraPaymentRequest, 'status' | 'createdById' | 'approvedBy'>,
  userId: string | undefined,
  role: Role | undefined,
): boolean {
  if (userId === undefined || role === undefined) return false;

  if (request.status === 'pendente_aprovacao') {
    return request.createdById === userId && canCreateExtraPayments(role);
  }
  if (request.status === 'aprovado') {
    return role === 'Admin Master' || request.approvedBy === userId;
  }
  return false;
}

export function canCancelPaymentInstallment(
  installment: Pick<PaymentInstallment, 'sourceType' | 'status' | 'paymentApprovedBy'>,
  userId: string | undefined,
  role: Role | undefined,
): boolean {
  if (userId === undefined || role === undefined) return false;
  if (installment.sourceType !== 'maintenance_order') return false;
  if (installment.status !== 'aprovado') return false;
  return role === 'Admin Master' || installment.paymentApprovedBy === userId;
}

export function shouldShowExtraCancelHint(
  installment: Pick<PaymentInstallment, 'sourceType' | 'status' | 'extraPaymentApprovedBy'>,
  userId: string | undefined,
  role: Role | undefined,
): boolean {
  if (userId === undefined || role === undefined) return false;
  if (installment.sourceType !== 'extra_payment') return false;
  if (installment.status !== 'aprovado') return false;
  return role === 'Admin Master' || installment.extraPaymentApprovedBy === userId;
}
