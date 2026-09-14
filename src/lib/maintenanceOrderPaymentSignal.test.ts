import { describe, expect, it } from 'vitest';

import {
  CANCELLED_ORDER_APPROVE_BLOCKED_TOOLTIP,
  CANCELLED_ORDER_APPROVE_REJECTED_MESSAGE,
  CANCELLED_ORDER_BUDGET_BADGE_LABEL,
  describeCancelPaymentExposure,
  describeInstallmentOriginSignal,
  describeMaintenanceOrderPaymentSignal,
  isMaintenanceOrderCancelled,
  MAINTENANCE_ORDER_PAYMENT_SIGNAL_BADGE,
} from './maintenanceOrderPaymentSignal';

describe('describeMaintenanceOrderPaymentSignal', () => {
  it('sinaliza OS cancelada como perigo', () => {
    expect(describeMaintenanceOrderPaymentSignal('Cancelado')).toEqual({
      label: 'OS cancelada',
      tone: 'danger',
    });
  });

  it('sinaliza serviço não concluído para status anteriores à conclusão', () => {
    for (const status of [
      'Orçamento aprovado',
      'Serviço em execução',
      'Aguardando orçamento',
      'Aguardando aprovação',
    ] as const) {
      expect(describeMaintenanceOrderPaymentSignal(status)).toEqual({
        label: 'Serviço não concluído',
        tone: 'warning',
      });
    }
  });

  it('não sinaliza serviço concluído nem veículo retirado', () => {
    expect(describeMaintenanceOrderPaymentSignal('Concluído')).toBeUndefined();
    expect(describeMaintenanceOrderPaymentSignal('Veículo retirado')).toBeUndefined();
  });

  it('não sinaliza status ausente', () => {
    expect(describeMaintenanceOrderPaymentSignal(undefined)).toBeUndefined();
    expect(describeMaintenanceOrderPaymentSignal(null)).toBeUndefined();
  });
});

describe('describeInstallmentOriginSignal', () => {
  it('ignora parcela de Pagamento Extra mesmo com status informado', () => {
    expect(describeInstallmentOriginSignal('extra_payment', 'Cancelado')).toBeUndefined();
  });

  it('usa o status da OS em parcela de manutenção', () => {
    expect(describeInstallmentOriginSignal('maintenance_order', 'Cancelado')).toEqual({
      label: 'OS cancelada',
      tone: 'danger',
    });
    expect(describeInstallmentOriginSignal('maintenance_order', 'Concluído')).toBeUndefined();
  });
});

describe('describeCancelPaymentExposure', () => {
  const failureMessage =
    'Não foi possível verificar se esta OS tem parcelas de pagamento lançadas. Confira em Financeiro → Pagamentos antes de cancelar.';

  it('avisa quantidade e valor quando há parcelas não reprovadas', () => {
    expect(describeCancelPaymentExposure({ count: 2, total: 1500 }, false)).toBe(
      'Esta OS já tem 2 parcela(s) de pagamento lançada(s), somando R$\u00a01.500,00. Cancelar a OS não cancela as parcelas — o Financeiro precisará tratá-las.',
    );
  });

  it('não avisa quando não há parcelas', () => {
    expect(describeCancelPaymentExposure({ count: 0, total: 0 }, false)).toBeUndefined();
  });

  it('não avisa enquanto a verificação não terminou', () => {
    expect(describeCancelPaymentExposure(undefined, false)).toBeUndefined();
  });

  it('avisa que não conseguiu verificar quando a consulta falha, mesmo com dado antigo', () => {
    expect(describeCancelPaymentExposure(undefined, true)).toBe(failureMessage);
    expect(describeCancelPaymentExposure({ count: 0, total: 0 }, true)).toBe(failureMessage);
  });
});

describe('MAINTENANCE_ORDER_PAYMENT_SIGNAL_BADGE', () => {
  it('usa pílulas contornadas, distintas dos badges sólidos de status da parcela', () => {
    expect(MAINTENANCE_ORDER_PAYMENT_SIGNAL_BADGE).toEqual({
      danger: 'border border-red-300 bg-white text-red-700',
      warning: 'border border-amber-300 bg-white text-amber-800',
    });
  });
});

describe('isMaintenanceOrderCancelled', () => {
  it('reconhece OS cancelada', () => {
    expect(isMaintenanceOrderCancelled('Cancelado')).toBe(true);
  });

  it('não considera cancelada nenhuma OS em outro status', () => {
    for (const status of [
      'Aguardando orçamento',
      'Aguardando aprovação',
      'Orçamento aprovado',
      'Serviço em execução',
      'Concluído',
      'Veículo retirado',
    ] as const) {
      expect(isMaintenanceOrderCancelled(status)).toBe(false);
    }
  });

  it('não considera cancelada OS sem status', () => {
    expect(isMaintenanceOrderCancelled(undefined)).toBe(false);
    expect(isMaintenanceOrderCancelled(null)).toBe(false);
  });
});

describe('textos da sinalização de OS cancelada na aprovação de orçamentos', () => {
  it('mantém os textos exibidos ao aprovador', () => {
    expect(CANCELLED_ORDER_BUDGET_BADGE_LABEL).toBe('OS CANCELADA');
    expect(CANCELLED_ORDER_APPROVE_BLOCKED_TOOLTIP).toBe('OS cancelada — não é possível aprovar');
    expect(CANCELLED_ORDER_APPROVE_REJECTED_MESSAGE).toBe('Não é possível aprovar: esta OS foi cancelada.');
  });
});
