import {
  buildChecklistSheetCells,
  buildChecklistSheetHeaders,
  buildIssueSheetCells,
  buildIssueSheetHeaders,
  flattenChecklistIssueRows,
  type ChecklistExportRow,
} from '../../lib/checklistExportRows';

import type { ExportProvider, ExportResult } from '../financialExport/types';

export class XlsxChecklistProvider implements ExportProvider {
  readonly code = 'checklists-xlsx';
  readonly name = 'Checklists (XLSX)';
  readonly description = 'Exporta os checklists realizados e suas inconformidades para uma planilha XLSX';

  constructor(private readonly includeClientColumn: boolean = false) {}

  async exportData(_clientId: string, data: ChecklistExportRow[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const includeClient = this.includeClientColumn;

    const checklistSheet = [
      buildChecklistSheetHeaders(includeClient).map(h => ({ value: h, type: String })),
      ...data.map(r => buildChecklistSheetCells(r, includeClient).map(c => ({ value: c, type: String }))),
    ];

    const issueRows = flattenChecklistIssueRows(data);
    const issueSheet = [
      buildIssueSheetHeaders(includeClient).map(h => ({ value: h, type: String })),
      ...issueRows.map(r => buildIssueSheetCells(r, includeClient).map(c => ({ value: c, type: String }))),
    ];

    const blob = await writeXlsxFile([
      { sheet: 'Checklists', data: checklistSheet },
      { sheet: 'Inconformidades', data: issueSheet },
    ]).toBlob();

    return { success: true, recordsSent: data.length, blob };
  }
}
