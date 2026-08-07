import type { ActionPlan } from '../types';

export type ActionPlanOrigin = 'checklist' | 'fleet_ticket';

export function actionPlanOriginOf(plan: Pick<ActionPlan, 'fleetTicketId'>): ActionPlanOrigin {
  return plan.fleetTicketId ? 'fleet_ticket' : 'checklist';
}

export function actionPlanOriginLabel(origin: ActionPlanOrigin): string {
  return origin === 'fleet_ticket' ? 'Chamado' : 'Checklist';
}

export function actionPlanOriginColor(origin: ActionPlanOrigin): string {
  return origin === 'fleet_ticket' ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800';
}
