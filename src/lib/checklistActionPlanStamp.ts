import type { ActionPlanStatus } from '../types/checklist';

export type ChecklistActionPlanStamp = 'none' | 'in_progress' | 'completed' | 'treated_by_ticket';

export const OPEN_ACTION_PLAN_STATUSES: readonly ActionPlanStatus[] = [
  'pending',
  'in_progress',
  'awaiting_conclusion',
];

export function computeChecklistActionPlanStamp(input: {
  planStatuses: readonly ActionPlanStatus[];
  treatedByTicket: boolean;
}): ChecklistActionPlanStamp {
  if (input.treatedByTicket) return 'treated_by_ticket';
  if (input.planStatuses.some((status) => OPEN_ACTION_PLAN_STATUSES.includes(status))) return 'in_progress';
  if (input.planStatuses.includes('completed')) return 'completed';
  return 'none';
}

export function checklistActionPlanStampLabel(stamp: ChecklistActionPlanStamp): string | null {
  if (stamp === 'in_progress') return 'Plano de ação em andamento';
  if (stamp === 'completed') return 'Plano de ação concluído';
  if (stamp === 'treated_by_ticket') return 'Tratado por chamado';
  return null;
}

export function checklistActionPlanStampColor(stamp: ChecklistActionPlanStamp): string {
  if (stamp === 'in_progress') return 'bg-amber-100 text-amber-800';
  if (stamp === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (stamp === 'treated_by_ticket') return 'bg-orange-100 text-orange-800';
  return '';
}
