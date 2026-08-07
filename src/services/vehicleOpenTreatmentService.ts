import { supabase } from '../lib/supabase';

import type { ActionPlanStatus } from '../types';

export interface VehicleOpenActionPlan {
  id: string;
  name?: string;
  suggestedAction: string;
  status: ActionPlanStatus;
  dueDate?: string;
  responsibleName?: string;
}

export interface VehicleOpenSchedule {
  id: string;
  scheduledDate: string;
  workshopName?: string;
}

export interface VehicleOpenTreatment {
  actionPlans: VehicleOpenActionPlan[];
  schedules: VehicleOpenSchedule[];
  ticketPlanIds: string[];
}

const OPEN_ACTION_PLAN_STATUSES = ['pending', 'in_progress', 'awaiting_conclusion'];

export async function getVehicleOpenTreatment(vehicleId: string): Promise<VehicleOpenTreatment> {
  const [openPlansResult, allPlansResult, schedulesResult] = await Promise.all([
    supabase
      .from('action_plans')
      .select('id, name, suggested_action, status, due_date, responsible_profile:profiles!responsible_id(name)')
      .eq('vehicle_id', vehicleId)
      .in('status', OPEN_ACTION_PLAN_STATUSES)
      .order('due_date', { ascending: true })
      .limit(5),
    supabase
      .from('action_plans')
      .select('fleet_ticket_id')
      .eq('vehicle_id', vehicleId)
      .not('fleet_ticket_id', 'is', null),
    supabase
      .from('workshop_schedules')
      .select('id, scheduled_date, workshops(name)')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
      .limit(5),
  ]);

  if (openPlansResult.error) throw openPlansResult.error;
  if (allPlansResult.error) throw allPlansResult.error;
  if (schedulesResult.error) throw schedulesResult.error;

  const actionPlans: VehicleOpenActionPlan[] = (openPlansResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: (row.name as string) ?? undefined,
    suggestedAction: row.suggested_action as string,
    status: row.status as ActionPlanStatus,
    dueDate: (row.due_date as string) ?? undefined,
    responsibleName: (row.responsible_profile as { name: string } | null)?.name ?? undefined,
  }));

  const schedules: VehicleOpenSchedule[] = (schedulesResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    scheduledDate: row.scheduled_date as string,
    workshopName: (row.workshops as { name: string } | null)?.name ?? undefined,
  }));

  const ticketPlanIds = [
    ...new Set(
      (allPlansResult.data ?? [])
        .map((row: { fleet_ticket_id: string | null }) => row.fleet_ticket_id)
        .filter((id): id is string => !!id),
    ),
  ];

  return { actionPlans, schedules, ticketPlanIds };
}
