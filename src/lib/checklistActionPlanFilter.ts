import type { ChecklistActionPlanStamp } from './checklistActionPlanStamp';

export const CHECKLIST_ACTION_PLAN_FILTER_OPTIONS: ReadonlyArray<{
  value: ChecklistActionPlanStamp;
  label: string;
}> = [
  { value: 'none', label: 'Sem plano' },
  { value: 'in_progress', label: 'Plano em andamento' },
  { value: 'completed', label: 'Plano concluído' },
  { value: 'treated_by_ticket', label: 'Tratado por chamado' },
];

export function matchesChecklistActionPlanFilter(input: {
  stamp: ChecklistActionPlanStamp;
  hasIssues: boolean;
  selected: readonly string[];
}): boolean {
  if (input.selected.length === 0) return true;
  if (input.stamp === 'none') return input.hasIssues && input.selected.includes('none');
  return input.selected.includes(input.stamp);
}
