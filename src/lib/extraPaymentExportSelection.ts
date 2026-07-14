import type { PaymentInstallment } from '../types/payment';

export function selectInstallmentsForVisibleRequests(
  installments: PaymentInstallment[],
  visibleRequestIds: Set<string>,
): PaymentInstallment[] {
  return installments.filter(
    installment => !!installment.extraPaymentRequestId && visibleRequestIds.has(installment.extraPaymentRequestId),
  );
}
