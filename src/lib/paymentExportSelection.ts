import type { PaymentInstallment } from '../types/payment';

export function resolveExportSelection(
  filtered: PaymentInstallment[],
  selectedIds: Set<string>,
): PaymentInstallment[] {
  if (selectedIds.size === 0) return filtered;
  return filtered.filter((installment) => selectedIds.has(installment.id));
}
