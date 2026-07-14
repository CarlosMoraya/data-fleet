import {
  MaintenanceOrder,
  BudgetItem,
  MaintenanceOrderRow,
  MaintenanceBudgetItemRow,
  MaintenancePartPhoto,
  MaintenancePartPhotoRow,
} from '../types/maintenance';

import { normalizeBudgetSystem } from './budgetSystems';

// Re-export para compatibilidade com código que importa daqui
export type {
  BudgetItem,
  MaintenanceBudgetItemRow,
  MaintenanceOrderRow,
  MaintenancePartPhoto,
  MaintenancePartPhotoRow,
};

export function budgetItemFromRow(row: MaintenanceBudgetItemRow): BudgetItem {
  return {
    id: row.id,
    maintenanceOrderId: row.maintenance_order_id,
    clientId: row.client_id,
    itemName: row.item_name,
    system: normalizeBudgetSystem(row.system),
    quantity: Number(row.quantity),
    value: Number(row.value),
    sortOrder: row.sort_order,
  };
}

export function partPhotoFromRow(row: MaintenancePartPhotoRow): MaintenancePartPhoto {
  return {
    id: row.id,
    maintenanceOrderId: row.maintenance_order_id,
    clientId: row.client_id,
    type: row.type,
    url: row.url,
    caption: row.caption ?? undefined,
    takenAt: row.taken_at,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  };
}

export function calcBudgetSubtotal(items: BudgetItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.value, 0);
}

export function buildVehicleModelLabel(model?: string | null): string | undefined {
  const label = model?.trim();
  return label || undefined;
}

export function maintenanceFromRow(row: MaintenanceOrderRow): MaintenanceOrder {
  return {
    id: row.id,
    os: row.os_number,
    licensePlate: row.vehicles?.license_plate || 'N/A',
    vehicleModel: buildVehicleModelLabel(row.vehicles?.model),
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
    budgetRejectionReason: row.budget_rejection_reason || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancelledById: row.cancelled_by_id || undefined,
    clientName: row.clients?.name || undefined,
    clientId: row.client_id,
    shipperName: row.vehicles?.shippers?.name || undefined,
    operationalUnitName: row.vehicles?.operational_units?.name || undefined,
    warrantyRevisionEventId: row.warranty_revision_event_id || undefined,
    actualExitDate: row.actual_exit_date || undefined,
  };
}
