import { BUDGET_STATUS_FILTER_OPTIONS } from './maintenanceFilters';

import type { MaintenanceOrder } from '../types/maintenance';


export type BudgetDecision = 'aprovado' | 'reprovado' | 'reaberto';

export interface BudgetHistoryFilters {
  decision: BudgetDecision | '';
  workshop: string;
  search: string;
}

export const BUDGET_DECISION_OPTIONS: { value: BudgetDecision; label: string }[] =
  BUDGET_STATUS_FILTER_OPTIONS.filter(
    (o) => o.value === 'aprovado' || o.value === 'reprovado' || o.value === 'reaberto',
  ) as { value: BudgetDecision; label: string }[];

export function buildBudgetHistoryWorkshopOptions(
  orders: Pick<MaintenanceOrder, 'workshop'>[],
): string[] {
  const set = new Set<string>();
  for (const o of orders) {
    const name = o.workshop?.trim();
    if (!name) continue;
    set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function applyBudgetHistoryFilters<
  T extends Pick<MaintenanceOrder, 'budgetStatus' | 'workshop' | 'os' | 'licensePlate' | 'workshopOs'>,
>(orders: T[], filters: BudgetHistoryFilters): T[] {
  const needle = filters.search.trim().toLowerCase();
  return orders.filter((order) => {
    if (filters.decision !== '' && order.budgetStatus !== filters.decision) return false;
    if (filters.workshop !== '' && order.workshop !== filters.workshop) return false;
    if (needle) {
      const os = (order.os ?? '').toLowerCase();
      const plate = (order.licensePlate ?? '').toLowerCase();
      const workshopOs = (order.workshopOs ?? '').toLowerCase();
      return os.includes(needle) || plate.includes(needle) || workshopOs.includes(needle);
    }
    return true;
  });
}