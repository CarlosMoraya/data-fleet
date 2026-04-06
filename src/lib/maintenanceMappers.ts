import { MaintenanceOrder, MaintenanceStatus, MaintenanceType } from '../pages/Maintenance';

export type BudgetStatus = 'sem_orcamento' | 'pendente' | 'aprovado' | 'reprovado';

export interface BudgetItem {
  id?: string;
  maintenanceOrderId?: string;
  clientId?: string;
  itemName: string;
  system: string;
  quantity: number;
  value: number;
  sortOrder: number;
}

export interface MaintenanceBudgetItemRow {
  id: string;
  maintenance_order_id: string;
  client_id: string;
  item_name: string;
  system: string | null;
  quantity: number;
  value: number;
  sort_order: number;
  created_at: string;
}

export function budgetItemFromRow(row: MaintenanceBudgetItemRow): BudgetItem {
  return {
    id: row.id,
    maintenanceOrderId: row.maintenance_order_id,
    clientId: row.client_id,
    itemName: row.item_name,
    system: row.system || '',
    quantity: Number(row.quantity),
    value: Number(row.value),
    sortOrder: row.sort_order,
  };
}

export function calcBudgetSubtotal(items: BudgetItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.value, 0);
}

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
  workshop_os_number: string | null;
  current_km: number | null;
  budget_pdf_url: string | null;
  budget_status: BudgetStatus | null;
  budget_reviewed_by: string | null;
  budget_reviewed_at: string | null;
  cancelled_at: string | null;
  cancelled_by_id: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  vehicles?: { license_plate: string };
  workshops?: { name: string };
  profiles?: { name: string };
  budget_reviewer?: { name: string };
  clients?: { name: string };
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
    workshopOs: row.workshop_os_number || undefined,
    currentKm: row.current_km !== null && row.current_km !== undefined ? Number(row.current_km) : undefined,
    budgetPdfUrl: row.budget_pdf_url || undefined,
    budgetStatus: row.budget_status || 'sem_orcamento',
    budgetReviewedBy: row.budget_reviewer?.name || undefined,
    budgetReviewedAt: row.budget_reviewed_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancelledById: row.cancelled_by_id || undefined,
    clientName: row.clients?.name || undefined,
    clientId: row.client_id,
  };
}
