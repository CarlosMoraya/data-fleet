import { buildPaymentTemplateCells, PAYMENT_TEMPLATE_HEADERS } from './paymentTemplateRows';

import type { ExportProvider, ExportResult } from './types';
import type { PaymentInstallment } from '../../types/payment';

/**
 * Provider `planilha` (Strategy): gera um CSV com as 10 colunas do template
 * `public/downloads/Planilha_Modelo -.xls`. Não acessa rede nem usa SheetJS.
 * Origem dos dados: `payment_installments` (parcela).
 */
export class SpreadsheetPaymentProvider implements ExportProvider {
  readonly code = 'planilha';
  readonly name = 'Planilha';
  readonly description = 'Exporta as parcelas de pagamento para uma planilha CSV';

  async exportData(_clientId: string, data: PaymentInstallment[]): Promise<ExportResult> {
    const rows = data.map(i => buildPaymentTemplateCells(i).map(escapeCsv).join(','));
    const csv = [PAYMENT_TEMPLATE_HEADERS.join(','), ...rows].join('\r\n');
    return { success: true, recordsSent: data.length, content: csv };
  }
}

function escapeCsv(value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
