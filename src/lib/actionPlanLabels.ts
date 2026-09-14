import type { ActionPlan } from '../types';

export interface ActionPlanLabelsRow {
  action_plan_id: string;
  reported_by_name: string | null;
  assigned_by_name: string | null;
  claimed_by_name: string | null;
  completed_by_name: string | null;
  responsible_name: string | null;
  template_name: string | null;
  item_title: string | null;
}

export interface ActionPlanLabels {
  actionPlanId: string;
  reportedByName?: string;
  assignedByName?: string;
  claimedByName?: string;
  completedByName?: string;
  responsibleName?: string;
  templateName?: string;
  itemTitle?: string;
}

export function actionPlanLabelsFromRow(row: ActionPlanLabelsRow): ActionPlanLabels {
  return {
    actionPlanId: row.action_plan_id,
    reportedByName: row.reported_by_name ?? undefined,
    assignedByName: row.assigned_by_name ?? undefined,
    claimedByName: row.claimed_by_name ?? undefined,
    completedByName: row.completed_by_name ?? undefined,
    responsibleName: row.responsible_name ?? undefined,
    templateName: row.template_name ?? undefined,
    itemTitle: row.item_title ?? undefined,
  };
}

export function mergeActionPlanLabels(plans: ActionPlan[], labels: ActionPlanLabels[]): ActionPlan[] {
  const labelsByActionPlanId = new Map<string, ActionPlanLabels>(
    labels.map((label) => [label.actionPlanId, label]),
  );

  return plans.map((plan) => {
    const label = labelsByActionPlanId.get(plan.id);
    if (!label) {
      return plan;
    }
    return {
      ...plan,
      reportedByName: plan.reportedByName ?? label.reportedByName,
      assignedByName: plan.assignedByName ?? label.assignedByName,
      claimedByName: plan.claimedByName ?? label.claimedByName,
      completedByName: plan.completedByName ?? label.completedByName,
      responsibleName: plan.responsibleName ?? label.responsibleName,
      templateName: plan.templateName ?? label.templateName,
      itemTitle: plan.itemTitle ?? label.itemTitle,
    };
  });
}