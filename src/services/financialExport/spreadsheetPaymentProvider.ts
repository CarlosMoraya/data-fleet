import type { ExportProvider, ExportResult } from './types';
import type { PaymentInstallment } from '../../types/payment';

const CSV_HEADERS = [
  'Data de Competência',
  'Data de Vencimento',
  'Data de Pagamento',
  'Valor',
  'Categoria',
  'Descrição',
  'Cliente/Fornecedor',
  'CNPJ/CPF Cliente/Fornecedor',
  'Centro de Custo',
  'Observações',
] as const;

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
    const rows = data.map(toCsvRow);
    const csv = [CSV_HEADERS.join(','), ...rows].join('\r\n');
    return { success: true, recordsSent: data.length, content: csv };
  }
}

function toCsvRow(installment: PaymentInstallment): string {
  // Data de Pagamento = vencimento da fatura = due_date (decisão da sessão).
  const cells = [
    escapeCsv(formatDateCell(installment.competenciaDate)),
    escapeCsv(formatDateCell(installment.dueDate)),
    escapeCsv(formatDateCell(installment.dueDate)),
    escapeCsv(formatValueCell(installment.value)),
    escapeCsv(installment.categoria),
    escapeCsv(installment.descricao),
    escapeCsv(installment.workshopName),
    escapeCsv(installment.workshopCnpj),
    escapeCsv(installment.centroCusto),
    escapeCsv(installment.notes),
  ];
  return cells.join(',');
}

function formatDateCell(date: string | undefined): string {
  if (!date) return '';
  const parts = date.length >= 10 ? date.slice(0, 10).split('-') : null;
  if (!parts || parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function formatValueCell(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const [intPart, fracPart] = rounded.toFixed(2).split('.');
  return `${addThousandsSeparator(intPart)},${fracPart}`;
}

function addThousandsSeparator(intStr: string): string {
  const negative = intStr.startsWith('-');
  const digits = negative ? intStr.slice(1) : intStr;
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

function escapeCsv(value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
