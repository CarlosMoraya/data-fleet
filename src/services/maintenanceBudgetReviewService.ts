import { budgetReviewFromRow, type MaintenanceBudgetReviewRow } from '../lib/maintenanceMappers';
import { supabase } from '../lib/supabase';

import type { BudgetReviewDecision, BudgetReviewEvent } from '../types/maintenance';

/**
 * Única porta de entrada da aplicação para o livro-razão append-only de
 * decisões de orçamento e para a transição de reabertura.
 * As regras de permissão vivem em `src/lib/maintenanceBudgetReopen.ts` e na
 * RLS — este módulo não decide quem pode o quê.
 */

export interface RecordBudgetReviewParams {
  maintenanceOrderId: string;
  clientId: string;
  decision: BudgetReviewDecision;
  reason?: string;
  budgetTotal?: number;
  profileId: string;
}

/** Insere uma linha no livro-razão. O ledger nunca sofre UPDATE nem DELETE. */
export async function recordBudgetReview(params: RecordBudgetReviewParams): Promise<void> {
  const { error } = await supabase
    .from('maintenance_budget_reviews')
    .insert({
      maintenance_order_id: params.maintenanceOrderId,
      client_id: params.clientId,
      decision: params.decision,
      reason: params.reason ?? null,
      budget_total: params.budgetTotal ?? null,
      decided_by: params.profileId,
    });
  if (error) throw error;
}

export interface ReopenRejectedBudgetParams {
  maintenanceOrderId: string;
  clientId: string;
  reason: string;
  profileId: string;
}

/**
 * Registra o evento de reabertura e move a OS para o estado reaberto.
 * A gravação do evento acontece ANTES de qualquer escrita na OS: se ela
 * falhar, a exceção interrompe tudo e o histórico jamais se perde por uma
 * falha parcial.
 */
export async function reopenRejectedBudget(params: ReopenRejectedBudgetParams): Promise<void> {
  const reason = params.reason.trim();
  if (reason === '') throw new Error('Informe a justificativa da reabertura.');

  const { data: order, error: readError } = await supabase
    .from('maintenance_orders')
    .select('budget_status, budget_rejection_reason')
    .eq('id', params.maintenanceOrderId)
    .single();
  if (readError) throw readError;
  if ((order as { budget_status: string } | null)?.budget_status !== 'reprovado') {
    throw new Error('Somente orçamentos reprovados podem ser reabertos.');
  }

  await recordBudgetReview({
    maintenanceOrderId: params.maintenanceOrderId,
    clientId: params.clientId,
    decision: 'reaberto',
    reason,
    profileId: params.profileId,
  });

  const { error } = await supabase
    .from('maintenance_orders')
    .update({
      budget_status: 'reaberto',
      status: 'Aguardando orçamento',
      budget_rejection_reason: null,
    })
    .eq('id', params.maintenanceOrderId);
  if (error) throw error;
}

/** Linha do tempo de decisões de uma OS, da mais recente para a mais antiga. */
export async function listBudgetReviewEvents(
  maintenanceOrderId: string,
): Promise<BudgetReviewEvent[]> {
  const { data, error } = await supabase
    .from('maintenance_budget_reviews')
    .select('*, decided_by_profile:profiles!decided_by (name)')
    .eq('maintenance_order_id', maintenanceOrderId)
    .order('decided_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as MaintenanceBudgetReviewRow[]).map(budgetReviewFromRow);
}
