import { VEHICLE_EXPORT_HEADERS, buildVehicleExportCells, type VehicleExportRow } from '../../lib/vehicleExportRows';

import type { ExportProvider, ExportResult } from '../financialExport/types';

export class XlsxVehicleProvider implements ExportProvider {
  readonly code = 'veiculos-xlsx';
  readonly name = 'Veículos (XLSX)';
  readonly description = 'Exporta os veículos da frota para uma planilha XLSX';

  async exportData(_clientId: string, data: VehicleExportRow[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    const rows = [
      VEHICLE_EXPORT_HEADERS.map(header => ({ value: header, type: String })),
      ...data.map(r => buildVehicleExportCells(r).map(cell => ({ value: cell, type: String }))),
    ];

    const blob = await writeXlsxFile(rows).toBlob();
    return { success: true, recordsSent: data.length, blob };
  }
}
