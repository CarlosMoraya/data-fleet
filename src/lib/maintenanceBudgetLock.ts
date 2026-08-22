import type { BudgetStatus } from '../types/maintenance';

/**
 * Quem está salvando uma OS cujo orçamento já foi aprovado:
 * - 'workshop': oficina registrando a execução — só campos operacionais e evidências.
 * - 'client':   Fleet Assistant+ — tudo, menos as colunas de orçamento.
 */
export type BudgetLockKind = 'workshop' | 'client';

/**
 * Orçamento aprovado é imutável para **todos** os papéis: itens, descontos, PDF
 * e os valores estimado/aprovado ficam congelados. A regra não depende de quem
 * está editando — o que varia é apenas o que cada papel ainda pode gravar fora
 * do orçamento (ver BudgetLockKind).
 */
export function isApprovedBudgetLocked(budgetStatus: BudgetStatus | undefined | null): boolean {
  return budgetStatus === 'aprovado';
}
