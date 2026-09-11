import type { InstallmentDraft, InstallmentInterval, PaymentInstallmentStatus } from '../types/payment';

const VALID_TRANSITIONS: Record<PaymentInstallmentStatus, PaymentInstallmentStatus[]> = {
  pendente_aprovacao: ['aprovado', 'reprovado'],
  aprovado: ['pago', 'cancelado'],
  reprovado: [],
  pago: [],
  cancelado: [],
};

/**
 * Divide `total` em `count` parcelas em centavos, jogando o resto do
 * arredondamento na última parcela. A soma das parcelas é exatamente `total`.
 */
export function splitInstallmentValue(total: number, count: number): number[] {
  if (count <= 0) return [];

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;

  const cents = new Array<number>(count).fill(baseCents);
  cents[count - 1] += remainder;

  return cents.map((c) => c / 100);
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addInterval(start: Date, interval: InstallmentInterval, step: number): Date {
  const d = new Date(start);
  switch (interval) {
    case 'mensal':
      d.setMonth(d.getMonth() + step);
      break;
    case 'quinzenal':
      d.setDate(d.getDate() + 15 * step);
      break;
    case 'semanal':
      d.setDate(d.getDate() + 7 * step);
      break;
  }
  return d;
}

/**
 * Gera `count` rascunhos de parcela a partir de um total, data base e intervalo.
 * Os valores vêm de `splitInstallmentValue`; os vencimentos incrementam pelo
 * intervalo informado. `paymentMethod` fica a cargo do formulário (lote/linha).
 */
export function generateInstallmentDrafts(params: {
  total: number;
  count: number;
  firstDueDate: string;
  interval: InstallmentInterval;
}): InstallmentDraft[] {
  const { total, count, firstDueDate, interval } = params;
  if (count <= 0) return [];

  const values = splitInstallmentValue(total, count);
  const start = new Date(`${firstDueDate}T00:00:00`);

  const drafts: InstallmentDraft[] = [];
  for (let i = 0; i < count; i++) {
    drafts.push({
      installmentNumber: i + 1,
      value: values[i],
      dueDate: formatDateOnly(addInterval(start, interval, i)),
    });
  }
  return drafts;
}

/**
 * Máquina de estados da parcela. Centraliza as transições válidas:
 * pendente_aprovacao → aprovado | reprovado; aprovado → pago | cancelado. Nada mais.
 */
export function canTransitionStatus(
  from: PaymentInstallmentStatus,
  to: PaymentInstallmentStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function sumInstallmentsValue(list: { value: number }[]): number {
  return list.reduce((sum, i) => sum + i.value, 0);
}

export function exceedsBudget(sum: number, budget: number): boolean {
  return Math.round(sum * 100) > Math.round(budget * 100);
}

const BUDGET_RELEASING_STATUSES: ReadonlySet<PaymentInstallmentStatus> = new Set<PaymentInstallmentStatus>(['reprovado', 'cancelado']);

function isCommitted(status?: PaymentInstallmentStatus): boolean {
  return status === undefined || !BUDGET_RELEASING_STATUSES.has(status);
}

/** Soma o valor das parcelas que ainda consomem o orçamento (exclui reprovadas e canceladas). */
export function sumCommittedValue(list: { value: number; status?: PaymentInstallmentStatus }[]): number {
  return list.reduce((sum, i) => (isCommitted(i.status) ? sum + i.value : sum), 0);
}

/** Conta as parcelas que ainda consomem o orçamento (exclui reprovadas e canceladas). */
export function countCommittedInstallments(list: { status?: PaymentInstallmentStatus }[]): number {
  return list.filter((i) => isCommitted(i.status)).length;
}

export function remainingBudget(
  approvedCost: number,
  existing: { value: number; status?: PaymentInstallmentStatus }[],
): number {
  return approvedCost - sumCommittedValue(existing);
}
