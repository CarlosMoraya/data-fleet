import type { PaymentInstallment } from '../types/payment';

/** Parcelas canceladas nunca vão para a planilha de pagamento (decisão do usuário, 2026-09-11). */
export function resolveExportSelection(
  filtered: PaymentInstallment[],
  selectedIds: Set<string>,
): PaymentInstallment[] {
  const exportable = filtered.filter((installment) => installment.status !== 'cancelado');
  if (selectedIds.size === 0) return exportable;
  return exportable.filter((installment) => selectedIds.has(installment.id));
}
