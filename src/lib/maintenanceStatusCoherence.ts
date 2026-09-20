import type { BudgetStatus, MaintenanceStatus } from '../types/maintenance';

export const BUDGET_AWAITING_DECISION_STATUSES: BudgetStatus[] = ['pendente', 'reaberto'];

/**
 * Mensagens das regras de transição. Ficam aqui, junto da regra, porque são
 * reaproveitadas pela tradução das recusas de banco (`maintenanceSaveError.ts`):
 * a camada de tela e a camada de banco não podem divergir no texto.
 */
export const BUDGET_APPROVED_STATUS_IS_AUTOMATIC_MESSAGE =
  'Não é possível mudar para "Orçamento aprovado": este status é definido automaticamente quando o orçamento é aprovado em Financeiro → Aprovação de Orçamentos.';

export const APPROVED_BUDGET_DOES_NOT_RETURN_MESSAGE =
  'Este orçamento já foi aprovado no Financeiro, então a OS não volta para "Aguardando aprovação". Para revisá-lo, use "Reabrir orçamento".';

export const PAYABLE_MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  'Orçamento aprovado',
  'Serviço em execução',
  'Concluído',
  'Veículo retirado',
];

export const BUDGET_GATED_STATUSES: MaintenanceStatus[] = [
  'Serviço em execução',
  'Concluído',
  'Veículo retirado',
];

export function canAdvanceMaintenanceStatus(
  target: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): boolean {
  if (target === 'Orçamento aprovado') return budgetStatus === 'aprovado';
  if (target === 'Aguardando aprovação') return budgetStatus !== 'aprovado';
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
    if (target === 'Orçamento aprovado') {
      return BUDGET_APPROVED_STATUS_IS_AUTOMATIC_MESSAGE;
    }
    if (target === 'Aguardando aprovação') {
      return APPROVED_BUDGET_DOES_NOT_RETURN_MESSAGE;
    }
    if (budgetStatus === 'reaberto') {
      return `Não é possível mudar para "${target}": o orçamento foi reaberto e ainda não foi reenviado para aprovação.`;
    }
    return `Não é possível mudar para "${target}": o orçamento ainda está aguardando aprovação.`;
  }
  return undefined;
}

export function requiresBudgetOverrideReason(
  currentStatus: MaintenanceStatus | undefined | null,
  target: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): boolean {
  if (!BUDGET_GATED_STATUSES.includes(target)) return false;
  if (budgetStatus === 'aprovado') return false;
  if (budgetStatus != null && BUDGET_AWAITING_DECISION_STATUSES.includes(budgetStatus)) return false;
  if (currentStatus != null && BUDGET_GATED_STATUSES.includes(currentStatus)) return false;
  return true;
}
