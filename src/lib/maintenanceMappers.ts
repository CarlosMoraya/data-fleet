import {
  MaintenanceOrder,
  BudgetItem,
  BudgetReviewDecision,
  BudgetReviewEvent,
  MaintenanceOrderRow,
  MaintenanceBudgetItemRow,
  MaintenancePartPhoto,
  MaintenancePartPhotoRow,
} from '../types/maintenance';

import { normalizeBudgetSystem } from './budgetSystems';

// Re-export para compatibilidade com código que importa daqui
export type {
  BudgetItem,
  BudgetReviewDecision,
  BudgetReviewEvent,
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
    discount: Number(row.discount ?? 0),
    sortOrder: row.sort_order,
  };
}

export interface MaintenanceBudgetReviewRow {
  id: string;
  maintenance_order_id: string;
  decision: BudgetReviewDecision;
  reason: string | null;
  budget_total: number | string | null;
  decided_at: string;
  decided_by_profile?: { name: string } | null;
}

export function budgetReviewFromRow(row: MaintenanceBudgetReviewRow): BudgetReviewEvent {
  return {
    id: row.id,
    maintenanceOrderId: row.maintenance_order_id,
    decision: row.decision,
    reason: row.reason ?? undefined,
    budgetTotal: row.budget_total !== null && row.budget_total !== undefined
      ? Number(row.budget_total)
      : undefined,
    decidedByName: row.decided_by_profile?.name ?? undefined,
    decidedAt: row.decided_at,
  };
}

export function calcBudgetItemNet(item: Pick<BudgetItem, 'quantity' | 'value' | 'discount'>): number {
  const gross = item.quantity * item.value;
  const discount = Math.min(Math.max(item.discount ?? 0, 0), gross);
  return gross - discount;
}

export interface BudgetTotals {
  subtotal: number;
  itemsDiscount: number;
  orderDiscount: number;
  total: number;
}

export function calcBudgetTotals(items: BudgetItem[], orderDiscount?: number): BudgetTotals {
  const subtotal = calcBudgetSubtotal(items);
  const itemsDiscount = items.reduce((sum, item) => {
    const gross = item.quantity * item.value;
    return sum + Math.min(Math.max(item.discount ?? 0, 0), gross);
  }, 0);
  const appliedOrderDiscount = Math.min(Math.max(orderDiscount ?? 0, 0), Math.max(0, subtotal - itemsDiscount));
  const total = Math.max(0, subtotal - itemsDiscount - appliedOrderDiscount);
  return { subtotal, itemsDiscount, orderDiscount: appliedOrderDiscount, total };
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
    budgetDiscount: Number(row.budget_discount ?? 0),
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
