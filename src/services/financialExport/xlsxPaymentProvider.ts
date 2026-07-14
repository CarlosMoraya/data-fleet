import { buildPaymentTemplateCells, PAYMENT_TEMPLATE_HEADERS } from './paymentTemplateRows';

import type { ExportProvider, ExportResult } from './types';
import type { PaymentInstallment } from '../../types/payment';

/**
 * Provider `planilha-xlsx` (Strategy): gera um `.xlsx` binário com as mesmas
 * 10 colunas do template `public/downloads/Planilha_Modelo -.xls`.
 * Usa `write-excel-file` (import dinâmico) — SheetJS permanece proibido no projeto.
 */
export class XlsxPaymentProvider implements ExportProvider {
  readonly code = 'planilha-xlsx';
  readonly name = 'Planilha (XLSX)';
  readonly description = 'Exporta as parcelas de pagamento para uma planilha XLSX';

  async exportData(_clientId: string, data: PaymentInstallment[]): Promise<ExportResult> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    const rows = [
      PAYMENT_TEMPLATE_HEADERS.map(header => ({ value: header, type: String })),
      ...data.map(i => buildPaymentTemplateCells(i).map(cell => ({ value: cell, type: String }))),
    ];

    const blob = await writeXlsxFile(rows).toBlob();
    return { success: true, recordsSent: data.length, blob };
  }
}
