import type { PaymentInstallment } from '../types/payment';

export interface MaintenancePaymentApprovalGroup {
  key: string;
  maintenanceOrderId: string;
  osNumber: string;
  workshopName: string;
  workshopCnpj?: string;
  budgetPdfUrl?: string;
  approvedCost: number;
  totalPending: number;
  installmentCount: number;
  installments: PaymentInstallment[];
  oldestCreatedAt: string;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function buildMaintenancePaymentGroup(
  maintenanceOrderId: string,
  installments: PaymentInstallment[],
): MaintenancePaymentApprovalGroup {
  const sorted = [...installments].sort((a, b) => {
    if (a.installmentNumber !== b.installmentNumber) {
      return a.installmentNumber - b.installmentNumber;
    }
    return a.dueDate.localeCompare(b.dueDate);
  });

  const first = sorted[0];
  const totalPendingCents = sorted.reduce((sum, i) => sum + toCents(i.value), 0);
  const oldestCreatedAt = sorted.reduce(
    (oldest, i) => (i.createdAt < oldest ? i.createdAt : oldest),
    first.createdAt,
  );

  return {
    key: `maintenance_order:${maintenanceOrderId}`,
    maintenanceOrderId,
    osNumber: first.maintenanceOrderOs ?? maintenanceOrderId,
    workshopName: first.workshopName ?? '—',
    workshopCnpj: first.workshopCnpj,
    budgetPdfUrl: first.budgetPdfUrl,
    approvedCost: first.maintenanceOrderApprovedCost ?? 0,
    totalPending: totalPendingCents / 100,
    installmentCount: sorted.length,
    installments: sorted,
    oldestCreatedAt,
  };
}

/**
 * Filtra, agrupa por OS, ordena e soma (em centavos) as parcelas pendentes
 * de manutenção. Ignora defensivamente Extras, parcelas não pendentes e
 * registros sem maintenanceOrderId.
 */
export function groupPendingMaintenancePayments(
  installments: PaymentInstallment[],
): MaintenancePaymentApprovalGroup[] {
  const byOrder = new Map<string, PaymentInstallment[]>();

  for (const installment of installments) {
    if (installment.sourceType !== 'maintenance_order') continue;
    if (installment.status !== 'pendente_aprovacao') continue;
    if (!installment.maintenanceOrderId) continue;

    const list = byOrder.get(installment.maintenanceOrderId) ?? [];
    list.push(installment);
    byOrder.set(installment.maintenanceOrderId, list);
  }

  const groups = Array.from(byOrder.entries()).map(([maintenanceOrderId, list]) =>
    buildMaintenancePaymentGroup(maintenanceOrderId, list),
  );

  return groups.sort((a, b) => a.oldestCreatedAt.localeCompare(b.oldestCreatedAt));
}
