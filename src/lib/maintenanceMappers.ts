import { MaintenanceOrder, MaintenanceStatus, MaintenanceType } from '../pages/Maintenance';

export interface MaintenanceOrderRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  workshop_id: string;
  os_number: string;
  entry_date: string;
  expected_exit_date: string | null;
  actual_exit_date: string | null;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string | null;
  mechanic_name: string | null;
  estimated_cost: number;
  approved_cost: number | null;
  created_by_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joins
  vehicles?: { license_plate: string };
  workshops?: { name: string };
  profiles?: { name: string };
}

export function maintenanceFromRow(row: MaintenanceOrderRow): MaintenanceOrder {
  return {
    id: row.id,
    os: row.os_number,
    licensePlate: row.vehicles?.license_plate || 'N/A',
    workshop: row.workshops?.name || 'Oficina não identificada',
    vehicleId: row.vehicle_id,
    workshopId: row.workshop_id,
    entryDate: row.entry_date,
    expectedExitDate: row.expected_exit_date || row.entry_date, 
    type: row.type,
    status: row.status,
    description: row.description || '',
    mechanicName: row.mechanic_name || '',
    estimatedCost: Number(row.estimated_cost),
    approvedCost: row.approved_cost !== null && row.approved_cost !== undefined ? Number(row.approved_cost) : undefined,
    createdBy: row.profiles?.name || 'Desconhecido',
    createdAt: row.created_at,
    notes: row.notes || undefined,
  };
}
