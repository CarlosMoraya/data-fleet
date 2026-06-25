import type { MaintenanceOrder } from '../types/maintenance';

export interface MaintenanceListFilters {
  statuses: string[];
  shippers: string[];
  operationalUnits: string[];
  workshops: string[];
}

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

export function applyMaintenanceListFilters<
  T extends Pick<MaintenanceOrder, 'status' | 'shipperName' | 'operationalUnitName' | 'workshop'>
>(
  orders: T[],
  filters: MaintenanceListFilters,
): T[] {
  const statusSet = filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const shipperSet = filters.shippers.length > 0 ? new Set(filters.shippers) : null;
  const unitSet = filters.operationalUnits.length > 0 ? new Set(filters.operationalUnits) : null;
  const workshopSet = filters.workshops.length > 0 ? new Set(filters.workshops) : null;

  return orders.filter((order) => {
    if (statusSet && !statusSet.has(order.status)) return false;
    if (shipperSet && !shipperSet.has(order.shipperName ?? '')) return false;
    if (unitSet && !unitSet.has(order.operationalUnitName ?? '')) return false;
    if (workshopSet && !workshopSet.has(order.workshop ?? '')) return false;
    return true;
  });
}
