import { BUDGET_DECISION_OPTIONS } from './budgetHistoryFilters';
import { formatDate } from './dateUtils';

import type { MaintenanceOrder } from '../types/maintenance';

export const BUDGET_HISTORY_EXPORT_HEADERS: readonly string[] = [
  'OS Interna', 'OS da Oficina', 'Placa', 'Oficina', 'Entrada',
  'Decisão', 'Valor Aprovado', 'Desconto', 'Revisado por', 'Revisado em',
  'Motivo da Reprovação',
];

function formatExportDate(value: string | null | undefined): string {
  const formatted = formatDate(value);
  return formatted === '—' ? '' : formatted;
}

function formatExportMoney(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildBudgetHistoryExportCells(row: MaintenanceOrder): string[] {
  const decisionOption = BUDGET_DECISION_OPTIONS.find(o => o.value === row.budgetStatus);
  return [
    row.os ?? '',
    row.workshopOs ?? '',
    row.licensePlate ?? '',
    row.workshop ?? '',
    formatExportDate(row.entryDate),
    decisionOption ? decisionOption.label : '',
    row.approvedCost != null ? formatExportMoney(row.approvedCost) : '',
    row.budgetDiscount != null && row.budgetDiscount !== 0 ? formatExportMoney(row.budgetDiscount) : '',
    row.budgetReviewedBy ?? '',
    formatExportDate(row.budgetReviewedAt),
    row.budgetRejectionReason ?? '',
  ];
}