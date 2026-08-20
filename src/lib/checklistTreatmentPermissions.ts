import type { ChecklistActionPlanStamp } from './checklistActionPlanStamp';
import type { ChecklistStatus } from '../types/checklist';

const CHECKLIST_TREATMENT_ROLES = [
  'Fleet Analyst',
  'Supervisor',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
] as const;

interface ChecklistTreatmentPermissionInput {
  role: string;
  checklistStatus: ChecklistStatus;
  hasIssues: boolean;
  blockWrite: boolean;
  stamp: ChecklistActionPlanStamp;
}

function canManageChecklistTreatment(input: ChecklistTreatmentPermissionInput): boolean {
  return CHECKLIST_TREATMENT_ROLES.some((role) => role === input.role)
    && input.checklistStatus === 'completed'
    && input.hasIssues
    && !input.blockWrite;
}

export function canCreateActionPlanFromChecklist(input: ChecklistTreatmentPermissionInput): boolean {
  return canManageChecklistTreatment(input) && input.stamp !== 'treated_by_ticket';
}

export function canMarkTreatedByTicket(input: ChecklistTreatmentPermissionInput): boolean {
  return canManageChecklistTreatment(input) && input.stamp === 'none';
}

export function canUnmarkTreatedByTicket(input: ChecklistTreatmentPermissionInput): boolean {
  return canManageChecklistTreatment(input) && input.stamp === 'treated_by_ticket';
}
