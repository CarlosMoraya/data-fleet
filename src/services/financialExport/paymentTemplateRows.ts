import type { PaymentInstallment } from '../../types/payment';

// Fonte única (SSOT) das 10 colunas do template `public/downloads/Planilha_Modelo -.xls`,
// consumida pelos providers CSV e XLSX para manter o layout idêntico.
export const PAYMENT_TEMPLATE_HEADERS: readonly string[] = [
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
];

/**
 * Retorna as 10 células cruas (não escapadas) de uma parcela, na mesma ordem
 * de `PAYMENT_TEMPLATE_HEADERS`. Data de Pagamento = vencimento da fatura = due_date.
 */
export function buildPaymentTemplateCells(installment: PaymentInstallment): string[] {
  return [
    formatDateCell(installment.competenciaDate),
    formatDateCell(installment.dueDate),
    formatDateCell(installment.dueDate),
    formatValueCell(installment.value),
    installment.extraPaymentCategory ?? installment.categoria ?? '',
    installment.descricao ?? '',
    installment.extraPaymentSupplierName ?? installment.workshopName ?? '',
    installment.extraPaymentSupplierDocument ?? installment.workshopCnpj ?? '',
    installment.centroCusto ?? '',
    installment.notes ?? '',
  ];
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
