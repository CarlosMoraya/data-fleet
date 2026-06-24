import type { MaintenanceOrder } from '../types/maintenance';

export interface MaintenanceListFilters {
  shippers: string[];
  operationalUnits: string[];
}

function normalizeName(value?: string): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function buildMaintenanceFilterOptions(
  orders: Pick<MaintenanceOrder, 'shipperName' | 'operationalUnitName'>[],
): { shippers: string[]; operationalUnits: string[] } {
  const shipperSet = new Set<string>();
  const unitSet = new Set<string>();

  for (const order of orders) {
    const s = normalizeName(order.shipperName);
    if (s) shipperSet.add(s);
    const u = normalizeName(order.operationalUnitName);
    if (u) unitSet.add(u);
  }

  return {
    shippers: [...shipperSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    operationalUnits: [...unitSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export function applyMaintenanceListFilters<T extends Pick<MaintenanceOrder, 'shipperName' | 'operationalUnitName'>>(
  orders: T[],
  filters: MaintenanceListFilters,
): T[] {
  const shipperSet = filters.shippers.length > 0 ? new Set(filters.shippers) : null;
  const unitSet = filters.operationalUnits.length > 0 ? new Set(filters.operationalUnits) : null;

  return orders.filter((order) => {
    if (shipperSet && !shipperSet.has(order.shipperName ?? '')) return false;
    if (unitSet && !unitSet.has(order.operationalUnitName ?? '')) return false;
    return true;
  });
}
