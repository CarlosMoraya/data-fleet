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
