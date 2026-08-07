import { BUDGET_STATUS_FILTER_OPTIONS, daysInWorkshop } from './maintenanceFilters';
import { formatDate } from './dateUtils';

import type { MaintenanceOrder, BudgetStatus } from '../types/maintenance';

export type MaintenanceExportRow = MaintenanceOrder & { clientDisplayName: string };

export const MAINTENANCE_EXPORT_HEADERS: readonly string[] = [
  'OS', 'OS da Oficina', 'Placa', 'Modelo', 'Tipo', 'Status', 'Oficina',
  'Embarcador', 'Unidade Operacional', 'Problema', 'Entrada',
  'Previsão de Saída', 'Saída Real', 'Dias na Oficina', 'Km na Entrada',
  'Status do Orçamento', 'Custo Estimado', 'Custo Aprovado', 'Desconto',
  'Motivo da Reprovação', 'Cliente',
];

const BUDGET_STATUS_EXPORT_LABELS: Record<BudgetStatus, string> = BUDGET_STATUS_FILTER_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<BudgetStatus, string>,
);

function formatExportDate(value: string | null | undefined): string {
  const formatted = formatDate(value);
  return formatted === '—' ? '' : formatted;
}

function formatExportMoney(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildMaintenanceExportCells(row: MaintenanceExportRow): string[] {
  const budgetStatus: BudgetStatus = row.budgetStatus ?? 'sem_orcamento';
  const daysStr = row.entryDate ? String(daysInWorkshop(row.entryDate)) : '';

  return [
    row.os ?? '',
    row.workshopOs ?? '',
    row.licensePlate ?? '',
    row.vehicleModel ?? '',
    row.type ?? '',
    row.status ?? '',
    row.workshop ?? '',
    row.shipperName ?? '',
    row.operationalUnitName ?? '',
    row.description ?? '',
    formatExportDate(row.entryDate),
    formatExportDate(row.expectedExitDate),
    formatExportDate(row.actualExitDate),
    daysStr,
    row.currentKm != null ? String(row.currentKm) : '',
    BUDGET_STATUS_EXPORT_LABELS[budgetStatus],
    formatExportMoney(row.estimatedCost),
    row.approvedCost != null ? formatExportMoney(row.approvedCost) : '',
    row.budgetDiscount != null && row.budgetDiscount !== 0 ? formatExportMoney(row.budgetDiscount) : '',
    row.budgetRejectionReason ?? '',
    row.clientDisplayName,
  ];
}
