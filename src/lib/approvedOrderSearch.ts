import { isOrderPayable } from './maintenanceStatusCoherence';
import { normalizeSearchText } from './textSearch';

import type { MaintenanceStatus } from '../types/maintenance';

export interface SearchableApprovedOrder {
  osNumber: string;
  workshopName: string;
  vehiclePlate?: string;
  remainingBudget: number;
  status: MaintenanceStatus;
}

export function selectSelectableApprovedOrders<T extends SearchableApprovedOrder>(
  orders: T[],
): T[] {
  return orders.filter(
    (order) => order.remainingBudget > 0 && isOrderPayable(order.status, 'aprovado'),
  );
}

export function buildApprovedOrderSearchText<T extends SearchableApprovedOrder>(
  order: T,
): string {
  return normalizeSearchText(
    `${order.vehiclePlate ?? ''} ${order.osNumber} ${order.workshopName}`,
  );
}

export function filterApprovedOrdersByQuery<T extends SearchableApprovedOrder>(
  orders: T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return orders;
  return orders.filter((order) => buildApprovedOrderSearchText(order).includes(normalizedQuery));
}
