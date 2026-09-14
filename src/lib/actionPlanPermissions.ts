import type { ActionPlan, ActionPlanStatus } from '../types';

// Literal transcription of the rank table that lived inside ActionPlanModal.
// It intentionally differs from ROLE_RANK in rolePermissions.ts (e.g. Operations
// Manager is 0 here): replacing it would silently change permissions.
export const ACTION_PLAN_MODAL_ROLE_RANK: Record<string, number> = {
  'Driver': 1,
  'Yard Auditor': 2,
  'Fleet Assistant': 3,
  'Fleet Analyst': 4,
  'Supervisor': 5,
  'Coordinator': 6,
  'Manager': 7,
  'Director': 8,
  'Admin Master': 9,
};

export const ACTION_PLAN_REASSIGNABLE_STATUSES: ActionPlanStatus[] = ['pending', 'in_progress', 'awaiting_conclusion'];

export const ACTION_PLAN_RESPONSIBLE_EXCLUDED_ROLES: readonly string[] = ['Driver'];

export const ACTION_PLAN_RESPONSIBLE_EXCLUDED_ROLES_FILTER = `(${ACTION_PLAN_RESPONSIBLE_EXCLUDED_ROLES.map((role) => `"${role}"`).join(',')})`;

export interface ActionPlanActionAvailability {
  canClaim: boolean;
  canConclude: boolean;
  canApproveOrReject: boolean;
  canReassignResponsible: boolean;
}

export function getActionPlanActionAvailability(
  role: string | undefined,
  userId: string | undefined,
  plan: Pick<ActionPlan, 'status' | 'claimedBy' | 'responsibleId'>,
): ActionPlanActionAvailability {
  if (role === 'Yard Auditor') {
    const isResponsible = !!userId && plan.responsibleId === userId;
    return {
      canClaim: isResponsible && plan.status === 'pending',
      canConclude: isResponsible && plan.status === 'in_progress',
      canApproveOrReject: false,
      canReassignResponsible: false,
    };
  }

  const rank = ACTION_PLAN_MODAL_ROLE_RANK[role ?? ''] ?? 0;
  return {
    canClaim: plan.status === 'pending' && rank >= ACTION_PLAN_MODAL_ROLE_RANK['Fleet Assistant'],
    canConclude:
      plan.status === 'in_progress' &&
      (plan.claimedBy === userId || rank >= ACTION_PLAN_MODAL_ROLE_RANK['Fleet Analyst']),
    canApproveOrReject: plan.status === 'awaiting_conclusion' && rank >= ACTION_PLAN_MODAL_ROLE_RANK['Fleet Analyst'],
    canReassignResponsible:
      rank >= ACTION_PLAN_MODAL_ROLE_RANK['Coordinator'] && ACTION_PLAN_REASSIGNABLE_STATUSES.includes(plan.status),
  };
}
