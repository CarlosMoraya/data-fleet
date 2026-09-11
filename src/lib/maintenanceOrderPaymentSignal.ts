import type { MaintenanceStatus } from '../types/maintenance';
import type { PaymentSourceType } from '../types/payment';

export type MaintenanceOrderPaymentSignalTone = 'danger' | 'warning';

export interface MaintenanceOrderPaymentSignal {
  label: string;
  tone: MaintenanceOrderPaymentSignalTone;
}

// Outlined on purpose: the solid red/amber pills in the same column already
// mean "Reprovado"/"Pendente de aprovação" for the installment itself.
export const MAINTENANCE_ORDER_PAYMENT_SIGNAL_BADGE: Record<MaintenanceOrderPaymentSignalTone, string> = {
  danger: 'border border-red-300 bg-white text-red-700',
  warning: 'border border-amber-300 bg-white text-amber-800',
};

const SERVICE_FINISHED_STATUSES: MaintenanceStatus[] = ['Concluído', 'Veículo retirado'];

export function describeMaintenanceOrderPaymentSignal(
  status: MaintenanceStatus | undefined | null,
): MaintenanceOrderPaymentSignal | undefined {
  if (!status) return undefined;
  if (status === 'Cancelado') return { label: 'OS cancelada', tone: 'danger' };
  if (SERVICE_FINISHED_STATUSES.includes(status)) return undefined;
  return { label: 'Serviço não concluído', tone: 'warning' };
}

export function describeInstallmentOriginSignal(
  sourceType: PaymentSourceType,
  maintenanceOrderStatus: MaintenanceStatus | undefined | null,
): MaintenanceOrderPaymentSignal | undefined {
  if (sourceType !== 'maintenance_order') return undefined;
  return describeMaintenanceOrderPaymentSignal(maintenanceOrderStatus);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function describeCancelPaymentExposure(
  exposure: { count: number; total: number } | undefined,
  failed: boolean,
): string | undefined {
  if (failed) {
    return 'Não foi possível verificar se esta OS tem parcelas de pagamento lançadas. Confira em Financeiro → Pagamentos antes de cancelar.';
  }
  if (!exposure || exposure.count === 0) return undefined;
  return `Esta OS já tem ${exposure.count} parcela(s) de pagamento lançada(s), somando ${formatCurrency(exposure.total)}. Cancelar a OS não cancela as parcelas — o Financeiro precisará tratá-las.`;
}
