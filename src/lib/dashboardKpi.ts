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
