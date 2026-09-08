import { MELI_UTILIZATION_EXPORT_HEADERS, buildMeliUtilizationExportCells } from '../../lib/meliUtilizationExportRows';

import type { MeliUtilizationRow } from '../../types/meliUtilization';
import type { ExportProvider, ExportResult } from '../financialExport/types';

export class XlsxMeliUtilizationProvider implements ExportProvider {
  readonly code = 'utilizacao-meli-xlsx';
  readonly name = 'Utilização MELI (XLSX)';
  readonly description = 'Exporta a utilização MELI da frota dedicada para uma planilha XLSX';

  async exportData(_clientId: string, data: MeliUtilizationRow[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    const rows = [
      MELI_UTILIZATION_EXPORT_HEADERS.map(header => ({ value: header, type: String })),
      ...data.map(r => buildMeliUtilizationExportCells(r).map(cell => ({ value: cell, type: String }))),
    ];

    const blob = await writeXlsxFile(rows).toBlob();
    return { success: true, recordsSent: data.length, blob };
  }
}