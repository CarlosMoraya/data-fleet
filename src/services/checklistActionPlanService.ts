import { supabase } from '../lib/supabase';

import type { ActionPlanStatus } from '../types/checklist';

export interface ChecklistTreatment {
  checklistId: string;
  fleetTicketId: string;
  fleetTicketNumber?: string;
  markedAt: string;
}

interface ActionPlanStatusRow {
  checklist_id: string;
  status: ActionPlanStatus;
}

interface FleetTicketNumberRow {
  ticket_number: string | null;
}

interface ChecklistTreatmentRow {
  checklist_id: string;
  fleet_ticket_id: string;
  marked_at: string;
  fleet_tickets: FleetTicketNumberRow | FleetTicketNumberRow[] | null;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

function fleetTicketNumberFromRelation(
  relation: FleetTicketNumberRow | FleetTicketNumberRow[] | null,
): string | undefined {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row?.ticket_number ?? undefined;
}

function throwMarkError(error: SupabaseErrorLike): never {
  console.error('markChecklistTreatedByTicket failed', error);
  if (error.message?.includes('CHECKLIST_ALREADY_HAS_ACTION_PLAN')) {
    throw new Error('Este checklist já possui plano de ação e não pode ser marcado como tratado por chamado.');
  }
  if (error.code === '23505') {
    throw new Error('Este checklist já está marcado como tratado por chamado. Atualize a página.');
  }
  if (error.code === '42501') {
    throw new Error('Você não tem permissão para marcar este checklist.');
  }
  throw new Error(error.message ?? 'Não foi possível marcar este checklist.');
}

function throwUnmarkError(error: SupabaseErrorLike): never {
  console.error('unmarkChecklistTreatedByTicket failed', error);
  if (error.code === '42501') {
    throw new Error('Você não tem permissão para desfazer esta marcação.');
  }
  throw new Error(error.message ?? 'Não foi possível desfazer esta marcação.');
}

export async function getChecklistActionPlanStatuses(
  checklistIds: string[],
): Promise<Map<string, ActionPlanStatus[]>> {
  if (checklistIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('action_plans')
    .select('checklist_id, status')
    .in('checklist_id', checklistIds);
  if (error) throw error;

  const result = new Map<string, ActionPlanStatus[]>();
  for (const row of (data ?? []) as ActionPlanStatusRow[]) {
    const statuses = result.get(row.checklist_id) ?? [];
    statuses.push(row.status);
    result.set(row.checklist_id, statuses);
  }
  return result;
}

export async function getChecklistTicketTreatments(
  checklistIds: string[],
): Promise<Map<string, ChecklistTreatment>> {
  if (checklistIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('checklist_ticket_treatments')
    .select('checklist_id, fleet_ticket_id, marked_at, fleet_tickets(ticket_number)')
    .in('checklist_id', checklistIds);
  if (error) throw error;

  const result = new Map<string, ChecklistTreatment>();
  for (const row of (data ?? []) as unknown as ChecklistTreatmentRow[]) {
    result.set(row.checklist_id, {
      checklistId: row.checklist_id,
      fleetTicketId: row.fleet_ticket_id,
      fleetTicketNumber: fleetTicketNumberFromRelation(row.fleet_tickets),
      markedAt: row.marked_at,
    });
  }
  return result;
}

export async function markChecklistTreatedByTicket(input: {
  clientId: string;
  checklistId: string;
  fleetTicketId: string;
  markedBy: string;
}): Promise<void> {
  const { data, error } = await supabase
    .from('checklist_ticket_treatments')
    .insert({
      client_id: input.clientId,
      checklist_id: input.checklistId,
      fleet_ticket_id: input.fleetTicketId,
      marked_by: input.markedBy,
    })
    .select('id');

  if (error) throwMarkError(error);
  if (!data || data.length === 0) {
    throwMarkError({ code: '42501', message: 'No rows returned after insert.' });
  }
}

export async function unmarkChecklistTreatedByTicket(checklistId: string): Promise<void> {
  const { data, error } = await supabase
    .from('checklist_ticket_treatments')
    .delete()
    .eq('checklist_id', checklistId)
    .select('id');

  if (error) throwUnmarkError(error);
  if (!data || data.length === 0) {
    throwUnmarkError({ code: '42501', message: 'No rows returned after delete.' });
  }
}
