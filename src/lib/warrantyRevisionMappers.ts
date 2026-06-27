import type {
  WarrantyRevisionPlan,
  WarrantyRevisionPlanRow,
  WarrantyRevisionPlanItem,
  WarrantyRevisionPlanItemRow,
  VehicleWarrantyAssignment,
  VehicleWarrantyAssignmentRow,
  WarrantyRevisionEvent,
  WarrantyRevisionEventRow,
} from '../types/warrantyRevision';

export function planFromRow(row: WarrantyRevisionPlanRow): WarrantyRevisionPlan {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    brand: row.brand,
    model: row.model,
    modelYearFrom: row.model_year_from,
    modelYearTo: row.model_year_to,
    category: row.category,
    shipperId: row.shipper_id,
    operationalUnitId: row.operational_unit_id,
    isAdhoc: row.is_adhoc,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function planToRow(
  plan: Partial<WarrantyRevisionPlan> & { clientId: string; name: string },
): Omit<WarrantyRevisionPlanRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    client_id: plan.clientId,
    name: plan.name,
    brand: plan.brand ?? null,
    model: plan.model ?? null,
    model_year_from: plan.modelYearFrom ?? null,
    model_year_to: plan.modelYearTo ?? null,
    category: plan.category ?? null,
    shipper_id: plan.shipperId ?? null,
    operational_unit_id: plan.operationalUnitId ?? null,
    is_adhoc: plan.isAdhoc ?? false,
    active: plan.active ?? true,
    created_by: plan.createdBy ?? null,
  };
}

export function planItemFromRow(row: WarrantyRevisionPlanItemRow): WarrantyRevisionPlanItem {
  return {
    id: row.id,
    planId: row.plan_id,
    clientId: row.client_id,
    sequence: row.sequence,
    label: row.label,
    targetKm: row.target_km,
    kmTolerance: row.km_tolerance,
    monthsFromAcquisition: row.months_from_acquisition,
    daysTolerance: row.days_tolerance,
    createdAt: row.created_at,
  };
}

export function planItemToRow(
  item: Partial<WarrantyRevisionPlanItem> & { planId: string; clientId: string; sequence: number; label: string; targetKm: number },
): Omit<WarrantyRevisionPlanItemRow, 'id' | 'created_at'> {
  return {
    plan_id: item.planId,
    client_id: item.clientId,
    sequence: item.sequence,
    label: item.label,
    target_km: item.targetKm,
    km_tolerance: item.kmTolerance ?? 0,
    months_from_acquisition: item.monthsFromAcquisition ?? null,
    days_tolerance: item.daysTolerance ?? 0,
  };
}

export function assignmentFromRow(row: VehicleWarrantyAssignmentRow): VehicleWarrantyAssignment {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    planId: row.plan_id,
    status: row.status,
    startKm: row.start_km,
    startDate: row.start_date,
    finishedReason: row.finished_reason,
    finishedBy: row.finished_by,
    finishedAt: row.finished_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eventFromRow(row: WarrantyRevisionEventRow): WarrantyRevisionEvent {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    clientId: row.client_id,
    vehicleId: row.vehicle_id,
    planItemId: row.plan_item_id,
    sequence: row.sequence,
    label: row.label,
    targetKm: row.target_km,
    targetDate: row.target_date,
    status: row.status,
    executedKm: row.executed_km,
    executedDate: row.executed_date,
    maintenanceOrderId: row.maintenance_order_id,
    evidenceUrl: row.evidence_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}