/**
 * Fonte única das constantes, mensagens e formatação da exceção de orçamento
 * de Ordem de Serviço, espelhada pelo gatilho fn_enforce_maintenance_budget_gate no banco.
 */

import { normalizeReasonText } from './reasonText';

import type { BudgetStatus, MaintenanceStatus } from '../types/maintenance';

export const BUDGET_OVERRIDE_REASON_MAX_LENGTH = 500;
export const BUDGET_OVERRIDE_REASON_INVALID_MESSAGE =
  'Informe o motivo da exceção (até 500 caracteres).';
export const BUDGET_OVERRIDE_REASON_NOT_INFORMED = 'Não informado';
export const BUDGET_OVERRIDE_AUTHOR_UNKNOWN = 'Não identificado';

export function normalizeBudgetOverrideReason(raw: string): string | null {
  return normalizeReasonText(raw, BUDGET_OVERRIDE_REASON_MAX_LENGTH);
}

export function formatBudgetOverrideReason(reason: string | undefined): string {
  if (reason === undefined || reason.trim().length === 0) {
    return BUDGET_OVERRIDE_REASON_NOT_INFORMED;
  }
  return reason.trim();
}

export function formatBudgetOverrideAuthor(name: string | undefined): string {
  if (name === undefined || name.trim().length === 0) {
    return BUDGET_OVERRIDE_AUTHOR_UNKNOWN;
  }
  return name.trim();
}

export function describeBudgetOverrideWarning(
  target: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): string {
  const prefix = budgetStatus === 'reprovado'
    ? 'O orçamento desta OS foi reprovado.'
    : 'Esta OS não tem orçamento aprovado.';
  return `${prefix} Mudar para "${target}" é uma exceção e ficará registrada com o seu nome, a data e o motivo informado.`;
}
