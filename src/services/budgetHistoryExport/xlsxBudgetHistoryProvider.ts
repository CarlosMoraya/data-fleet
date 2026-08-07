import { BUDGET_HISTORY_EXPORT_HEADERS, buildBudgetHistoryExportCells } from '../../lib/budgetHistoryExportRows';

import type { MaintenanceOrder } from '../../types/maintenance';
import type { ExportProvider, ExportResult } from '../financialExport/types';


export class XlsxBudgetHistoryProvider implements ExportProvider {
  readonly code = 'historico-orcamentos-xlsx';
  readonly name = 'Histórico de Orçamentos (XLSX)';
  readonly description = 'Exporta os orçamentos já aprovados ou reprovados para uma planilha XLSX';

  async exportData(_clientId: string, data: MaintenanceOrder[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    const rows = [
      BUDGET_HISTORY_EXPORT_HEADERS.map(header => ({ value: header, type: String })),
      ...data.map(r => buildBudgetHistoryExportCells(r).map(cell => ({ value: cell, type: String }))),
    ];

    const blob = await writeXlsxFile(rows).toBlob();
    return { success: true, recordsSent: data.length, blob };
  }
}