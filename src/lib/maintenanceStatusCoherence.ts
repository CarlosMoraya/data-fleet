import type { BudgetStatus, MaintenanceStatus } from '../types/maintenance';

export const BUDGET_AWAITING_DECISION_STATUSES: BudgetStatus[] = ['pendente', 'reaberto'];

export const PAYABLE_MAINTENANCE_STATUSES: MaintenanceStatus[] = ['Concluído', 'Veículo retirado'];

export const BUDGET_GATED_STATUSES: MaintenanceStatus[] = [
  'Serviço em execução',
  'Concluído',
  'Veículo retirado',
];

export function canAdvanceMaintenanceStatus(
  target: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): boolean {
  return !(
    BUDGET_GATED_STATUSES.includes(target)
    && budgetStatus != null
    && BUDGET_AWAITING_DECISION_STATUSES.includes(budgetStatus)
  );
}

export function isOrderPayable(
  status: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): boolean {
  return budgetStatus === 'aprovado' && PAYABLE_MAINTENANCE_STATUSES.includes(status);
}

export function describeStatusBlockReason(
  target: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): string | undefined {
  if (!canAdvanceMaintenanceStatus(target, budgetStatus)) {
    if (budgetStatus === 'reaberto') {
      return `Não é possível mudar para "${target}": o orçamento foi reaberto e ainda não foi reenviado para aprovação.`;
    }
    return `Não é possível mudar para "${target}": o orçamento ainda está aguardando aprovação.`;
  }
  return undefined;
}
