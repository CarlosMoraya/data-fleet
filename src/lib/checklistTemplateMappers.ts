import type {
  ChecklistItemSuggestion,
  ChecklistTemplate,
  ChecklistTemplateVersion,
  ChecklistItem,
  VehicleCategory,
  TemplateStatus,
} from '../types';
import { normalizeTrim } from './inputHelpers';

// ─── Row types (snake_case from Supabase) ─────────────────────────────────────

export interface SuggestionRow {
  id: string;
  vehicle_category: string;
  title: string;
  description: string | null;
  is_mandatory: boolean;
  require_photo_if_issue: boolean;
  default_action: string | null;
  order_number: number;
}

export interface ChecklistTemplateRow {
  id: string;
  client_id: string;
  vehicle_category: string | null;
  is_free_form: boolean;
  name: string;
  description: string | null;
  current_version: number;
  status: string;
  allow_driver_actions: boolean;
  allow_auditor_actions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplateVersionRow {
  id: string;
  template_id: string;
  version_number: number;
  published_at: string;
  published_by: string | null;
}

export interface ChecklistItemRow {
  id: string;
  template_id: string;
  version_number: number;
  title: string;
  description: string | null;
  is_mandatory: boolean;
  require_photo_if_issue: boolean;
  default_action: string | null;
  order_number: number;
}

// ─── fromRow converters ───────────────────────────────────────────────────────

export function suggestionFromRow(row: SuggestionRow): ChecklistItemSuggestion {
  return {
    id: row.id,
    vehicleCategory: row.vehicle_category as VehicleCategory,
    title: row.title,
    description: row.description ?? undefined,
    isMandatory: row.is_mandatory,
    requirePhotoIfIssue: row.require_photo_if_issue,
    defaultAction: row.default_action ?? undefined,
    orderNumber: row.order_number,
  };
}

export function templateFromRow(row: ChecklistTemplateRow): ChecklistTemplate {
  return {
    id: row.id,
    clientId: row.client_id,
    vehicleCategory: row.vehicle_category as VehicleCategory | undefined ?? undefined,
    isFreeForm: row.is_free_form,
    name: row.name,
    description: row.description ?? undefined,
    currentVersion: row.current_version,
    status: row.status as TemplateStatus,
    allowDriverActions: row.allow_driver_actions,
    allowAuditorActions: row.allow_auditor_actions,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function templateVersionFromRow(row: ChecklistTemplateVersionRow): ChecklistTemplateVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: row.version_number,
    publishedAt: row.published_at,
    publishedBy: row.published_by ?? undefined,
  };
}

export function checklistItemFromRow(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: row.version_number,
    title: row.title,
    description: row.description ?? undefined,
    isMandatory: row.is_mandatory,
    requirePhotoIfIssue: row.require_photo_if_issue,
    defaultAction: row.default_action ?? undefined,
    orderNumber: row.order_number,
  };
}

// ─── toRow converters ─────────────────────────────────────────────────────────

export function templateToRow(t: Partial<ChecklistTemplate>): Partial<ChecklistTemplateRow> {
  const row: Partial<ChecklistTemplateRow> = {};
  if (t.clientId !== undefined)          row.client_id = t.clientId;
  if (t.vehicleCategory !== undefined)   row.vehicle_category = t.vehicleCategory ?? null;
  if (t.isFreeForm !== undefined)        row.is_free_form = t.isFreeForm;
  if (t.name !== undefined)              row.name = normalizeTrim(t.name);
  if (t.description !== undefined)       row.description = t.description ? normalizeTrim(t.description) : null;
  if (t.currentVersion !== undefined)    row.current_version = t.currentVersion;
  if (t.status !== undefined)            row.status = t.status;
  if (t.allowDriverActions !== undefined) row.allow_driver_actions = t.allowDriverActions;
  if (t.allowAuditorActions !== undefined) row.allow_auditor_actions = t.allowAuditorActions;
  if (t.createdBy !== undefined)         row.created_by = t.createdBy ?? null;
  return row;
}

export function checklistItemToRow(item: Partial<ChecklistItem>): Partial<ChecklistItemRow> {
  const row: Partial<ChecklistItemRow> = {};
  if (item.templateId !== undefined)           row.template_id = item.templateId;
  if (item.versionNumber !== undefined)        row.version_number = item.versionNumber;
  if (item.title !== undefined)                row.title = normalizeTrim(item.title);
  if (item.description !== undefined)          row.description = item.description ? normalizeTrim(item.description) : null;
  if (item.isMandatory !== undefined)          row.is_mandatory = item.isMandatory;
  if (item.requirePhotoIfIssue !== undefined)  row.require_photo_if_issue = item.requirePhotoIfIssue;
  if (item.defaultAction !== undefined)        row.default_action = item.defaultAction ? normalizeTrim(item.defaultAction) : null;
  if (item.orderNumber !== undefined)          row.order_number = item.orderNumber;
  return row;
}
