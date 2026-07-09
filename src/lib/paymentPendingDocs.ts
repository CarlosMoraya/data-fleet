import type { ActionQueueItemLike } from '../components/dashboard/ActionQueue';
import type { PaymentInstallment } from '../types/payment';

/**
 * Pure function: builds the "Fila de Ação" queue of installments missing payment
 * data. A parcela entra na fila quando:
 *  - é `boleto` sem `boleto_url`; OU
 *  - é `pix` sem `pix_key` OU sem `pix_beneficiary_name`.
 * Severity sempre `medium`. `category` identificador estável para filtro de UI.
 */
export function buildPaymentPendingQueue(
  installments: PaymentInstallment[],
): ActionQueueItemLike[] {
  const pending = installments.filter((i) => {
    if (i.paymentMethod === 'boleto') return !i.boletoUrl;
    if (i.paymentMethod === 'pix') return !i.pixKey || !i.pixBeneficiaryName;
    return false;
  });

  if (pending.length === 0) return [];

  const details = pending.map((i) => {
    const os = i.maintenanceOrderOs ?? i.maintenanceOrderId;
    return `#${i.installmentNumber}/${i.installmentsTotal} — ${os ?? 'OS'}`;
  });

  return [
    {
      category: 'payment-missing-docs',
      label: 'Parcelas sem dados de pagamento',
      count: pending.length,
      severity: 'medium',
      details,
    },
  ];
}