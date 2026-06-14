import type { MaintenanceOrderDashboard } from '../types/maintenance';
import type { VehicleRow } from '../components/dashboard/OperationalPanel';

export function countActiveInMaintenance(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status'>[],
  vehicles: Pick<VehicleRow, 'id' | 'type'>[],
  vehicleTypeFilter: string | null
): number {
  let active = orders.filter(
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado'
  );

  if (vehicleTypeFilter) {
    const vIds = new Set(
      vehicles.filter((v) => v.type === vehicleTypeFilter).map((v) => v.id)
    );
    active = active.filter((o) => vIds.has(o.vehicle_id));
  }

  return active.length;
}

export function buildActiveMaintenanceTypeData(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status' | 'type'>[],
  vehicles: Pick<VehicleRow, 'id' | 'type'>[],
  vehicleTypeFilter: string | null
): { name: MaintenanceOrderDashboard['type']; value: number }[] {
  let active = orders.filter(
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado'
  );

  if (vehicleTypeFilter) {
    const vIds = new Set(
      vehicles.filter((v) => v.type === vehicleTypeFilter).map((v) => v.id)
    );
    active = active.filter((o) => vIds.has(o.vehicle_id));
  }

  const maintenanceTypes = ['Corretiva', 'Preventiva', 'Preditiva'] as const;
  const result: { name: MaintenanceOrderDashboard['type']; value: number }[] = [];

  for (const type of maintenanceTypes) {
    const count = active.filter((o) => o.type === type).length;
    if (count > 0) {
      result.push({ name: type, value: count });
    }
  }

  return result;
}

// ─── Executive KPIs & Action Queue (Fase 1) ────────────────────────────────

export type ActionSeverity = 'high' | 'medium';

export interface ActionItem {
  category: 'checklist' | 'crlv' | 'cnh' | 'os_overdue' | 'os_pending_approval';
  label: string;
  count: number;
  severity: ActionSeverity;
}

export function calculateFleetAvailability(totalVehicles: number, vehiclesInMaintenance: number): number {
  if (totalVehicles <= 0) return 0;
  const result = Math.round(((totalVehicles - vehiclesInMaintenance) / totalVehicles) * 100);
  return Math.max(0, Math.min(100, result));
}

export function countVehiclesInMaintenance(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status'>[],
  vehicleTypeFilter: string | null,
  vehicles: Pick<VehicleRow, 'id' | 'type'>[]
): number {
  const active = orders.filter(
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado'
  );

  if (vehicleTypeFilter) {
    const allowedVehicleIds = new Set(
      vehicles.filter((v) => v.type === vehicleTypeFilter).map((v) => v.id)
    );
    const filtered = active.filter((o) => allowedVehicleIds.has(o.vehicle_id));
    return new Set(filtered.map((o) => o.vehicle_id)).size;
  }

  return new Set(active.map((o) => o.vehicle_id)).size;
}

export function calculateChecklistComplianceRate(totalVehicles: number, overdueVehicleCount: number): number {
  if (totalVehicles <= 0) return 100;
  const result = Math.round(((totalVehicles - overdueVehicleCount) / totalVehicles) * 100);
  return Math.max(0, Math.min(100, result));
}

export function countOverdueMaintenanceOrders(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'expected_exit_date'>[],
  todayIso: string
): number {
  return orders.filter(
    (o) =>
      o.status !== 'Concluído' &&
      o.status !== 'Cancelado' &&
      o.expected_exit_date != null &&
      o.expected_exit_date < todayIso
  ).length;
}

export function countPendingApprovalOrders(
  orders: Pick<MaintenanceOrderDashboard, 'status'>[]
): number {
  return orders.filter((o) => o.status === 'Aguardando aprovação').length;
}

export function buildActionQueue(input: {
  overdueChecklistCount: number;
  expiredCrlvCount: number;
  expiredCnhCount: number;
  overdueOsCount: number;
  pendingApprovalCount: number;
}): ActionItem[] {
  const items: ActionItem[] = [
    { category: 'checklist', label: 'Veículos com checklist vencido', count: input.overdueChecklistCount, severity: 'high' },
    { category: 'crlv', label: 'Veículos com CRLV vencido', count: input.expiredCrlvCount, severity: 'high' },
    { category: 'cnh', label: 'Motoristas com CNH vencida', count: input.expiredCnhCount, severity: 'high' },
    { category: 'os_overdue', label: 'OS com prazo de saída vencido', count: input.overdueOsCount, severity: 'high' },
    { category: 'os_pending_approval', label: 'OS aguardando aprovação', count: input.pendingApprovalCount, severity: 'medium' },
  ];

  return items
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const order = { high: 0, medium: 1 };
      return order[a.severity] - order[b.severity];
    });
}
