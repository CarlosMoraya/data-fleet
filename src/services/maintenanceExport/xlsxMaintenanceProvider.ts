import { MAINTENANCE_EXPORT_HEADERS, buildMaintenanceExportCells, type MaintenanceExportRow } from '../../lib/maintenanceExportRows';

import type { ExportProvider, ExportResult } from '../financialExport/types';

export class XlsxMaintenanceProvider implements ExportProvider {
  readonly code = 'manutencoes-xlsx';
  readonly name = 'Manutenções (XLSX)';
  readonly description = 'Exporta as ordens de serviço de manutenção para uma planilha XLSX';

  async exportData(_clientId: string, data: MaintenanceExportRow[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    const rows = [
      MAINTENANCE_EXPORT_HEADERS.map(header => ({ value: header, type: String })),
      ...data.map(r => buildMaintenanceExportCells(r).map(cell => ({ value: cell, type: String }))),
    ];

    const blob = await writeXlsxFile(rows).toBlob();
    return { success: true, recordsSent: data.length, blob };
  }
}
