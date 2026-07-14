import type { BudgetStatus, MaintenanceOrder, MaintenanceStatus } from '../types/maintenance';

export interface MaintenanceListFilters {
  statuses: string[];
  shippers: string[];
  operationalUnits: string[];
  workshops: string[];
  budgetStatuses: string[];
}

export const BUDGET_STATUS_FILTER_OPTIONS: { value: BudgetStatus; label: string }[] = [
  { value: 'sem_orcamento', label: 'Sem Orçamento' },
  { value: 'pendente', label: 'Aguardando Aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
];

function normalizeName(value?: string): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function buildMaintenanceFilterOptions(
  orders: Pick<MaintenanceOrder, 'shipperName' | 'operationalUnitName' | 'workshop'>[],
): { shippers: string[]; operationalUnits: string[]; workshops: string[] } {
  const shipperSet = new Set<string>();
  const unitSet = new Set<string>();
  const workshopSet = new Set<string>();

  for (const order of orders) {
    const s = normalizeName(order.shipperName);
    if (s) shipperSet.add(s);
    const u = normalizeName(order.operationalUnitName);
    if (u) unitSet.add(u);
    const w = normalizeName(order.workshop);
    if (w) workshopSet.add(w);
  }

  return {
    shippers: [...shipperSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    operationalUnits: [...unitSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    workshops: [...workshopSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export function matchesMaintenanceSearch(
  order: Pick<MaintenanceOrder, 'licensePlate' | 'os' | 'description' | 'vehicleModel'>,
  term: string,
): boolean {
  const trimmed = term.trim();
  if (!trimmed) return true;
  const needle = trimmed.toLowerCase();
  const plate = (order.licensePlate ?? '').toLowerCase();
  const os = (order.os ?? '').toLowerCase();
  const description = (order.description ?? '').toLowerCase();
  const model = (order.vehicleModel ?? '').toLowerCase();
  return plate.includes(needle) || os.includes(needle) || description.includes(needle) || model.includes(needle);
}

export function applyMaintenanceListFilters<
  T extends Pick<MaintenanceOrder, 'status' | 'shipperName' | 'operationalUnitName' | 'workshop' | 'budgetStatus'>
>(
  orders: T[],
  filters: MaintenanceListFilters,
): T[] {
  const statusSet = filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const shipperSet = filters.shippers.length > 0 ? new Set(filters.shippers) : null;
  const unitSet = filters.operationalUnits.length > 0 ? new Set(filters.operationalUnits) : null;
  const workshopSet = filters.workshops.length > 0 ? new Set(filters.workshops) : null;
  const budgetStatusSet = filters.budgetStatuses.length > 0
    ? new Set(
        BUDGET_STATUS_FILTER_OPTIONS
          .filter(o => filters.budgetStatuses.includes(o.label))
          .map(o => o.value),
      )
    : null;

  return orders.filter((order) => {
    if (statusSet && !statusSet.has(order.status)) return false;
    if (shipperSet && !shipperSet.has(order.shipperName ?? '')) return false;
    if (unitSet && !unitSet.has(order.operationalUnitName ?? '')) return false;
    if (workshopSet && !workshopSet.has(order.workshop ?? '')) return false;
    if (budgetStatusSet && !budgetStatusSet.has(order.budgetStatus ?? 'sem_orcamento')) return false;
    return true;
  });
}

// Status que liberam o veículo para uma nova OS (veículo "Retirado" ou OS cancelada).
// Qualquer outro status é considerado "OS em aberto" e bloqueia nova OS para o mesmo veículo.
export const MAINTENANCE_TERMINAL_STATUSES = new Set<MaintenanceStatus>([
  'Veículo retirado',
  'Cancelado',
]);

export function getVehicleIdsWithOpenMaintenance(
  orders: Pick<MaintenanceOrder, 'vehicleId' | 'status'>[],
): Set<string> {
  const blocked = new Set<string>();
  for (const order of orders) {
    if (!order.vehicleId) continue;
    if (!MAINTENANCE_TERMINAL_STATUSES.has(order.status)) {
      blocked.add(order.vehicleId);
    }
  }
  return blocked;
}

export type MaintenanceCardKey =
  | 'total'
  | 'aguardando-orcamento'
  | 'aguardando-aprovacao'
  | 'em-execucao'
  | 'corretiva'
  | 'nao-retirados';

export function countVehiclesNotWithdrawn(
  orders: Pick<MaintenanceOrder, 'vehicleId' | 'status'>[],
): number {
  const set = new Set<string>();
  for (const order of orders) {
    if (!order.vehicleId) continue;
    if (order.status === 'Concluído') {
      set.add(order.vehicleId);
    }
  }
  return set.size;
}

export function matchesMaintenanceCard(
  order: Pick<MaintenanceOrder, 'status' | 'type'>,
  cardKey: MaintenanceCardKey,
): boolean {
  switch (cardKey) {
    case 'total':
      return !MAINTENANCE_TERMINAL_STATUSES.has(order.status);
    case 'aguardando-orcamento':
      return order.status === 'Aguardando orçamento';
    case 'aguardando-aprovacao':
      return order.status === 'Aguardando aprovação';
    case 'em-execucao':
      return order.status === 'Serviço em execução';
    case 'corretiva':
      return order.type === 'Corretiva';
    case 'nao-retirados':
      return order.status === 'Concluído';
  }
}
