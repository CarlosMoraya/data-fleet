import { DRIVER_EXPORT_HEADERS, buildDriverExportCells, type DriverExportRow } from '../../lib/driverExportRows';

import type { ExportProvider, ExportResult } from '../financialExport/types';

export class XlsxDriverProvider implements ExportProvider {
  readonly code = 'motoristas-xlsx';
  readonly name = 'Motoristas (XLSX)';
  readonly description = 'Exporta os motoristas da frota para uma planilha XLSX';

  async exportData(_clientId: string, data: DriverExportRow[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    const rows = [
      DRIVER_EXPORT_HEADERS.map(header => ({ value: header, type: String })),
      ...data.map(r => buildDriverExportCells(r).map(cell => ({ value: cell, type: String }))),
    ];

    const blob = await writeXlsxFile(rows).toBlob();
    return { success: true, recordsSent: data.length, blob };
  }
}
