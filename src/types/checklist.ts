// ─── Checklists ───────────────────────────────────────────────────────────────

export type VehicleCategory = 'Leve' | 'Médio' | 'Pesado' | 'Elétrico';
export type TemplateCategory = VehicleCategory;
export type ChecklistContext = 'Rotina' | 'Auditoria' | 'Reboque' | 'Entrada em Oficina' | 'Saída de Oficina' | 'Segurança';
export const WORKSHOP_CONTEXTS: ChecklistContext[] = ['Entrada em Oficina', 'Saída de Oficina'];
export type TemplateStatus = 'draft' | 'published' | 'deprecated';
export type ChecklistStatus = 'in_progress' | 'completed';
export type ResponseStatus = 'ok' | 'issue' | 'skipped' | 'not_applicable';
export type ActionPlanStatus = 'pending' | 'in_progress' | 'awaiting_conclusion' | 'completed' | 'cancelled';

export interface ChecklistItemSuggestion {
  id: string;
  vehicleCategory: VehicleCategory;
  title: string;
  description?: string;
  isMandatory: boolean;
  requirePhotoIfIssue: boolean;
  defaultAction?: string;
  orderNumber: number;
}

export interface ChecklistTemplate {
  id: string;
  clientId: string;
  vehicleCategory: VehicleCategory;
  context: ChecklistContext;
  name: string;
  description?: string;
  currentVersion: number;
  status: TemplateStatus;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistTemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy?: string;
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  versionNumber: number;
  title: string;
  description?: string;
  isMandatory: boolean;
  requirePhotoIfIssue: boolean;
  canBlockVehicle: boolean;
  defaultAction?: string;
  orderNumber: number;
}

export interface Checklist {
  id: string;
  clientId: string;
  templateId: string;
  templateName?: string; // from join
  templateContext?: ChecklistContext; // from join
  versionNumber: number;
  vehicleId?: string;
  vehicleLicensePlate?: string; // from join
  filledBy: string;
  filledByName?: string; // from join
  startedAt: string;
  completedAt?: string;
  status: ChecklistStatus;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  notes?: string;
  workshopId?: string;
  workshopName?: string; // from join
  odometerKm?: number;
}

export interface ChecklistResponse {
  id: string;
  checklistId: string;
  itemId: string;
  itemTitle?: string; // from join
  status: ResponseStatus;
  observation?: string;
  photoUrl?: string;
  respondedAt: string;
}

export interface ActionPlan {
  id: string;
  clientId: string;
  checklistId: string;
  checklistResponseId?: string;
  vehicleId?: string;
  vehicleLicensePlate?: string; // from join
  reportedBy?: string;
  reportedByName?: string; // from join
  suggestedAction: string;
  observedIssue?: string;
  photoUrl?: string;
  status: ActionPlanStatus;
  // v2 fields
  name?: string;
  responsibleId?: string;
  responsibleName?: string; // from join
  dueDate?: string;
  assignedBy?: string;
  assignedByName?: string; // from join
  claimedBy?: string;
  claimedByName?: string; // from join
  claimedAt?: string;
  conclusionEvidenceUrl?: string;
  // completion
  completionNotes?: string;
  completedBy?: string;
  completedByName?: string; // from join
  completedAt?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
  // from join
  itemTitle?: string;
  templateName?: string;
}

// ─── Checklist Day Intervals ────────────────────────────────────────────────

export interface ChecklistDayInterval {
  id: string;
  clientId: string;
  rotinaDayInterval: number | null;
  segurancaDayInterval: number | null;
  pneusDayInterval: number | null;
  updatedAt?: string;
  updatedBy?: string;
}
