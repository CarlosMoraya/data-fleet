import { actionPlanLabelsFromRow, type ActionPlanLabels, type ActionPlanLabelsRow } from '../lib/actionPlanLabels';
import { supabase } from '../lib/supabase';

export async function getYardAuditorActionPlanLabels(actionPlanIds: string[]): Promise<ActionPlanLabels[]> {
  if (actionPlanIds.length === 0) return [];

  const rpcResult = await supabase.rpc('get_yard_auditor_action_plan_labels', {
    p_action_plan_ids: actionPlanIds,
  });
  if (rpcResult.error) throw rpcResult.error;

  return ((rpcResult.data as ActionPlanLabelsRow[] | null) ?? []).map(actionPlanLabelsFromRow);
}
