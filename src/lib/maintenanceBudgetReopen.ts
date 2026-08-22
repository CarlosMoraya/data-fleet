import type { BudgetStatus } from '../types/maintenance';

/**
 * Papéis do cliente autorizados a reabrir um orçamento reprovado.
 * Espelha literalmente a allowlist da policy de INSERT de
 * `maintenance_budget_reviews`, acrescida de 'Admin Master'.
 * O papel 'Workshop' nunca reabre: a oficina propõe, não decide.
 */
export const BUDGET_REOPEN_ROLES: readonly string[] = [
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

/**
 * Decide se a ação "Reabrir orçamento" está disponível.
 * Só `reprovado` é reabrível — `aprovado` nunca, nem por Admin Master.
 */
export function canReopenBudget(
  budgetStatus: BudgetStatus | undefined | null,
  role: string | undefined | null,
  isWorkshopAccount: boolean,
): boolean {
  if (budgetStatus !== 'reprovado') return false;
  if (isWorkshopAccount) return false;
  return BUDGET_REOPEN_ROLES.includes(role ?? '');
}

/** Diz se o orçamento está no estado reaberto (em revisão). */
export function isBudgetUnderRevision(budgetStatus: BudgetStatus | undefined | null): boolean {
  return budgetStatus === 'reaberto';
}

/**
 * Decide se o salvamento de uma OS reaberta deve devolvê-la à fila de
 * aprovação. Exige itens significativos E PDF de orçamento presentes.
 */
export function shouldResubmitReopenedBudget(args: {
  budgetStatus: BudgetStatus | undefined | null;
  hasSignificantItems: boolean;
  hasBudgetPdf: boolean;
}): boolean {
  if (!isBudgetUnderRevision(args.budgetStatus)) return false;
  return args.hasSignificantItems && args.hasBudgetPdf;
}

/**
 * Trava dos campos de desconto do orçamento. Só orçamento aprovado trava —
 * `reprovado` e `reaberto` seguem editáveis, porque o reenvio é permitido
 * enquanto o orçamento não estiver aprovado.
 */
export function isBudgetDiscountLocked(budgetStatus: BudgetStatus | undefined | null): boolean {
  return budgetStatus === 'aprovado';
}
