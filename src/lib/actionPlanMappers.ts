import type { ActionPlan, ActionPlanStatus } from '../types';
import { normalizeTrim } from './inputHelpers';

// ─── Row type (snake_case from Supabase) ──────────────────────────────────────

export interface ActionPlanRow {
  id: string;
  client_id: string;
  checklist_id: string;
  checklist_response_id: string | null;
  vehicle_id: string | null;
  reported_by: string | null;
  suggested_action: string;
  observed_issue: string | null;
  photo_url: string | null;
  status: string;
  work_order_number: string | null;
  completion_notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  // join fields
  vehicles?: { license_plate: string } | null;
  profiles?: { name: string } | null;
  completed_by_profile?: { name: string } | null;
  checklist_items?: { title: string } | null;
  checklist_templates?: { name: string } | null;
}

// ─── fromRow converter ────────────────────────────────────────────────────────

export function actionPlanFromRow(row: ActionPlanRow): ActionPlan {
  return {
    id: row.id,
    clientId: row.client_id,
    checklistId: row.checklist_id,
    checklistResponseId: row.checklist_response_id ?? undefined,
    vehicleId: row.vehicle_id ?? undefined,
    vehicleLicensePlate: row.vehicles?.license_plate ?? undefined,
    reportedBy: row.reported_by ?? undefined,
    reportedByName: row.profiles?.name ?? undefined,
    suggestedAction: row.suggested_action,
    observedIssue: row.observed_issue ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    status: row.status as ActionPlanStatus,
    workOrderNumber: row.work_order_number ?? undefined,
    completionNotes: row.completion_notes ?? undefined,
    completedBy: row.completed_by ?? undefined,
    completedByName: row.completed_by_profile?.name ?? undefined,
    completedAt: row.completed_at ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemTitle: row.checklist_items?.title ?? undefined,
    templateName: row.checklist_templates?.name ?? undefined,
  };
}

// ─── toRow converter ──────────────────────────────────────────────────────────

export function actionPlanToRow(a: Partial<ActionPlan>): Partial<ActionPlanRow> {
  const row: Partial<ActionPlanRow> = {};
  if (a.clientId !== undefined)              row.client_id = a.clientId;
  if (a.checklistId !== undefined)           row.checklist_id = a.checklistId;
  if (a.checklistResponseId !== undefined)   row.checklist_response_id = a.checklistResponseId ?? null;
  if (a.vehicleId !== undefined)             row.vehicle_id = a.vehicleId ?? null;
  if (a.reportedBy !== undefined)            row.reported_by = a.reportedBy ?? null;
  if (a.suggestedAction !== undefined)       row.suggested_action = normalizeTrim(a.suggestedAction);
  if (a.observedIssue !== undefined)         row.observed_issue = a.observedIssue ? normalizeTrim(a.observedIssue) : null;
  if (a.photoUrl !== undefined)              row.photo_url = a.photoUrl ?? null;
  if (a.status !== undefined)                row.status = a.status;
  if (a.workOrderNumber !== undefined)       row.work_order_number = a.workOrderNumber ? normalizeTrim(a.workOrderNumber) : null;
  if (a.completionNotes !== undefined)       row.completion_notes = a.completionNotes ? normalizeTrim(a.completionNotes) : null;
  if (a.completedBy !== undefined)           row.completed_by = a.completedBy ?? null;
  if (a.completedAt !== undefined)           row.completed_at = a.completedAt ?? null;
  if (a.latitude !== undefined)              row.latitude = a.latitude ?? null;
  if (a.longitude !== undefined)             row.longitude = a.longitude ?? null;
  return row;
}

// ─── Label helpers ────────────────────────────────────────────────────────────

export function actionStatusLabel(status: ActionPlanStatus): string {
  const labels: Record<ActionPlanStatus, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  };
  return labels[status] ?? status;
}

export function actionStatusColor(status: ActionPlanStatus): string {
  const colors: Record<ActionPlanStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-zinc-100 text-zinc-600',
  };
  return colors[status] ?? 'bg-zinc-100 text-zinc-600';
}
