// ─── Revisões de Garantia ────────────────────────────────────────────────────

export type WarrantyRevisionEventStatus = 'pending' | 'presumed_completed' | 'completed';

export type WarrantyRevisionStatus = 'em_dia' | 'a_vencer' | 'vencida' | 'aguardando_proxima';

export type WarrantyRegime = 'warranty' | 'preventive' | 'none';

export type AssignmentFinishReason =
  | 'warranty_expired'
  | 'km_limit_reached'
  | 'manual_finish'
  | 'all_done_confirmed'
  | 'vehicle_out_of_warranty';

export type AssignmentStatus = 'active' | 'finished' | 'cancelled';

// ─── Plan ────────────────────────────────────────────────────────────────────

export interface WarrantyRevisionPlan {
  id: string;
  clientId: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  modelYearFrom?: number | null;
  modelYearTo?: number | null;
  category?: string | null;
  shipperId?: string | null;
  operationalUnitId?: string | null;
  isAdhoc: boolean;
  active: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyRevisionPlanRow {
  id: string;
  client_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  model_year_from: number | null;
  model_year_to: number | null;
  category: string | null;
  shipper_id: string | null;
  operational_unit_id: string | null;
  is_adhoc: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Plan Item ────────────────────────────────────────────────────────────────

export interface WarrantyRevisionPlanItem {
  id: string;
  planId: string;
  clientId: string;
  sequence: number;
  label: string;
  targetKm: number;
  kmTolerance: number;
  monthsFromAcquisition?: number | null;
  daysTolerance: number;
  createdAt: string;
}

export interface WarrantyRevisionPlanItemRow {
  id: string;
  plan_id: string;
  client_id: string;
  sequence: number;
  label: string;
  target_km: number;
  km_tolerance: number;
  months_from_acquisition: number | null;
  days_tolerance: number;
  created_at: string;
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export interface VehicleWarrantyAssignment {
  id: string;
  clientId: string;
  vehicleId: string;
  planId: string;
  status: AssignmentStatus;
  startKm?: number | null;
  startDate?: string | null;
  finishedReason?: AssignmentFinishReason | null;
  finishedBy?: string | null;
  finishedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleWarrantyAssignmentRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  plan_id: string;
  status: AssignmentStatus;
  start_km: number | null;
  start_date: string | null;
  finished_reason: AssignmentFinishReason | null;
  finished_by: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface WarrantyRevisionEvent {
  id: string;
  assignmentId: string;
  clientId: string;
  vehicleId: string;
  planItemId?: string | null;
  sequence: number;
  label: string;
  targetKm: number;
  targetDate?: string | null;
  status: WarrantyRevisionEventStatus;
  executedKm?: number | null;
  executedDate?: string | null;
  maintenanceOrderId?: string | null;
  evidenceUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyRevisionEventRow {
  id: string;
  assignment_id: string;
  client_id: string;
  vehicle_id: string;
  plan_item_id: string | null;
  sequence: number;
  label: string;
  target_km: number;
  target_date: string | null;
  status: WarrantyRevisionEventStatus;
  executed_km: number | null;
  executed_date: string | null;
  maintenance_order_id: string | null;
  evidence_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}