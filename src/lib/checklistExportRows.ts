import { formatDateForExport } from './dateUtils';

export interface ChecklistIssueDetail {
  itemTitle: string;
  observation: string;
  photoUrl: string;
}

export interface ChecklistExportRow {
  clientDisplayName: string;
  templateName: string;
  templateContext: string;
  licensePlate: string;
  shipperName: string;
  operationalUnitName: string;
  vehicleDriverName: string;
  filledByName: string;
  startedAt: string;
  statusLabel: string;
  lastKmText: string;
  actionPlanLabel: string;
  locationDeniedLabel: string;
  vehicleLinkDivergenceLabel: string;
  issues: ChecklistIssueDetail[];
}

export interface ChecklistIssueExportRow extends Omit<ChecklistExportRow, 'issues'> {
  issue: ChecklistIssueDetail;
}

export function buildChecklistSheetHeaders(includeClientColumn: boolean): string[] {
  return [
    ...(includeClientColumn ? ['Cliente'] : []),
    'Template',
    'Contexto',
    'Placa',
    'Embarcador',
    'Unidade Operacional',
    'Motorista do veículo',
    'Preenchido por',
    'Data',
    'Status',
    'Último Km',
    'Qtd. inconformidades',
    'Plano de ação',
    'Localização negada',
    'Divergência de vínculo',
  ];
}

export function buildChecklistSheetCells(
  row: ChecklistExportRow,
  includeClientColumn: boolean,
): string[] {
  return [
    ...(includeClientColumn ? [row.clientDisplayName] : []),
    row.templateName,
    row.templateContext,
    row.licensePlate,
    row.shipperName,
    row.operationalUnitName,
    row.vehicleDriverName,
    row.filledByName,
    formatDateForExport(row.startedAt),
    row.statusLabel,
    row.lastKmText,
    String(row.issues.length),
    row.actionPlanLabel,
    row.locationDeniedLabel,
    row.vehicleLinkDivergenceLabel,
  ];
}

export function buildIssueSheetHeaders(includeClientColumn: boolean): string[] {
  return [
    ...(includeClientColumn ? ['Cliente'] : []),
    'Template',
    'Contexto',
    'Placa',
    'Embarcador',
    'Unidade Operacional',
    'Motorista do veículo',
    'Preenchido por',
    'Data',
    'Status',
    'Último Km',
    'Item da inconformidade',
    'Observação',
    'Foto (link)',
    'Plano de ação',
    'Localização negada',
    'Divergência de vínculo',
  ];
}

export function flattenChecklistIssueRows(rows: ChecklistExportRow[]): ChecklistIssueExportRow[] {
  return rows.flatMap(({ issues, ...checklist }) =>
    issues.map((issue) => ({ ...checklist, issue }))
  );
}

export function buildIssueSheetCells(
  row: ChecklistIssueExportRow,
  includeClientColumn: boolean,
): string[] {
  return [
    ...(includeClientColumn ? [row.clientDisplayName] : []),
    row.templateName,
    row.templateContext,
    row.licensePlate,
    row.shipperName,
    row.operationalUnitName,
    row.vehicleDriverName,
    row.filledByName,
    formatDateForExport(row.startedAt),
    row.statusLabel,
    row.lastKmText,
    row.issue.itemTitle,
    row.issue.observation,
    row.issue.photoUrl,
    row.actionPlanLabel,
    row.locationDeniedLabel,
    row.vehicleLinkDivergenceLabel,
  ];
}
