import { describe, expect, it } from 'vitest';

import {
  canCancelExtraPaymentRequest,
  canCancelPaymentInstallment,
  CANCELLATION_IRREVERSIBLE_WARNING,
  CANCELLATION_NOT_APPLIED_MESSAGE,
  CANCELLATION_REASON_INVALID_MESSAGE,
  CANCELLATION_REASON_MAX_LENGTH,
  EXTRA_PAYMENT_INSTALLMENT_CANCEL_HINT,
  normalizeCancellationReason,
  shouldShowExtraCancelHint,
} from './paymentCancellation';

import type { PaymentInstallment } from '../types/payment';
import type { ExtraPaymentRequest } from '../types/serviceExpense';

// ─── normalizeCancellationReason (6) ────────────────────────────────────────

describe('normalizeCancellationReason', () => {
  it('1 — trim em texto com espaços extras', () => {
    expect(normalizeCancellationReason('  Pagamento duplicado  ')).toBe('Pagamento duplicado');
  });

  it('2 — string vazia retorna null', () => {
    expect(normalizeCancellationReason('')).toBeNull();
  });

  it('3 — string com espaços e quebras de linha retorna null', () => {
    expect(normalizeCancellationReason('   \n\t ')).toBeNull();
  });

  it('4 — 500 caracteres aceitos', () => {
    expect(normalizeCancellationReason('a'.repeat(500))).toBe('a'.repeat(500));
  });

  it('5 — 501 caracteres rejeitados', () => {
    expect(normalizeCancellationReason('a'.repeat(501))).toBeNull();
  });

  it('6 — trim reduz 500 para dentro do limite', () => {
    expect(normalizeCancellationReason('  ' + 'a'.repeat(500) + '  ')).toBe('a'.repeat(500));
  });
});

// ─── canCancelExtraPaymentRequest (13) ─────────────────────────────────────

const baseExtra: Pick<ExtraPaymentRequest, 'status' | 'createdById' | 'approvedBy'> = {
  status: 'aprovado',
  createdById: 'creator-1',
  approvedBy: 'approver-1',
};

describe('canCancelExtraPaymentRequest', () => {
  it('7 — aprovador do pedido aprovado pode cancelar', () => {
    expect(canCancelExtraPaymentRequest(baseExtra, 'approver-1', 'Coordinator')).toBe(true);
  });

  it('8 — outro coordenador não pode cancelar', () => {
    expect(canCancelExtraPaymentRequest(baseExtra, 'other-2', 'Coordinator')).toBe(false);
  });

  it('9 — Admin Master pode cancelar pedido aprovado por qualquer um', () => {
    expect(canCancelExtraPaymentRequest(baseExtra, 'am-9', 'Admin Master')).toBe(true);
  });

  it('10 — Fleet Assistant sem ser o aprovador não pode cancelar pedido aprovado', () => {
    expect(canCancelExtraPaymentRequest(baseExtra, 'creator-1', 'Fleet Assistant')).toBe(false);
  });

  it('11 — pedido pago não pode ser cancelado', () => {
    expect(
      canCancelExtraPaymentRequest({ ...baseExtra, status: 'pago' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('12 — pedido reprovado não pode ser cancelado', () => {
    expect(
      canCancelExtraPaymentRequest({ ...baseExtra, status: 'reprovado' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('13 — pedido já cancelado não pode ser cancelado novamente', () => {
    expect(
      canCancelExtraPaymentRequest({ ...baseExtra, status: 'cancelado' }, 'am-9', 'Admin Master'),
    ).toBe(false);
  });

  it('14 — criador com papel que pode criar extras cancela pedido pendente', () => {
    expect(
      canCancelExtraPaymentRequest(
        { ...baseExtra, status: 'pendente_aprovacao', approvedBy: undefined },
        'creator-1',
        'Fleet Assistant',
      ),
    ).toBe(true);
  });

  it('15 — outro coordenador não pode cancelar pedido pendente de outro', () => {
    expect(
      canCancelExtraPaymentRequest(
        { ...baseExtra, status: 'pendente_aprovacao', approvedBy: undefined },
        'other-2',
        'Coordinator',
      ),
    ).toBe(false);
  });

  it('16 — criador com papel Financeiro não pode cancelar pedido pendente', () => {
    expect(
      canCancelExtraPaymentRequest(
        { ...baseExtra, status: 'pendente_aprovacao', approvedBy: undefined },
        'creator-1',
        'Financeiro',
      ),
    ).toBe(false);
  });

  it('17 — userId undefined retorna false', () => {
    expect(canCancelExtraPaymentRequest(baseExtra, undefined, 'Admin Master')).toBe(false);
  });

  it('18 — approvedBy undefined e userId !== createdById retorna false', () => {
    expect(
      canCancelExtraPaymentRequest({ ...baseExtra, approvedBy: undefined }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('19 — role undefined retorna false', () => {
    expect(canCancelExtraPaymentRequest(baseExtra, 'approver-1', undefined)).toBe(false);
  });
});

// ─── canCancelPaymentInstallment (8) ───────────────────────────────────────

const baseInstallment: Pick<PaymentInstallment, 'sourceType' | 'status' | 'paymentApprovedBy'> = {
  sourceType: 'maintenance_order',
  status: 'aprovado',
  paymentApprovedBy: 'approver-1',
};

describe('canCancelPaymentInstallment', () => {
  it('20 — aprovador da parcela de OS pode cancelar', () => {
    expect(canCancelPaymentInstallment(baseInstallment, 'approver-1', 'Coordinator')).toBe(true);
  });

  it('21 — outro gestor não pode cancelar', () => {
    expect(canCancelPaymentInstallment(baseInstallment, 'other-2', 'Manager')).toBe(false);
  });

  it('22 — Admin Master pode cancelar parcela aprovada por qualquer um', () => {
    expect(canCancelPaymentInstallment(baseInstallment, 'am-9', 'Admin Master')).toBe(true);
  });

  it('23 — parcela paga não pode ser cancelada', () => {
    expect(
      canCancelPaymentInstallment({ ...baseInstallment, status: 'pago' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('24 — parcela pendente de aprovação não pode ser cancelada', () => {
    expect(
      canCancelPaymentInstallment({ ...baseInstallment, status: 'pendente_aprovacao' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('25 — parcela já cancelada não pode ser cancelada novamente', () => {
    expect(
      canCancelPaymentInstallment({ ...baseInstallment, status: 'cancelado' }, 'am-9', 'Admin Master'),
    ).toBe(false);
  });

  it('26 — parcela de origem extra não pode ser cancelada por esta função', () => {
    expect(
      canCancelPaymentInstallment({ ...baseInstallment, sourceType: 'extra_payment' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('27 — userId undefined retorna false', () => {
    expect(canCancelPaymentInstallment(baseInstallment, undefined, 'Admin Master')).toBe(false);
  });
});

// ─── shouldShowExtraCancelHint (6) ─────────────────────────────────────────

const baseHint: Pick<PaymentInstallment, 'sourceType' | 'status' | 'extraPaymentApprovedBy'> = {
  sourceType: 'extra_payment',
  status: 'aprovado',
  extraPaymentApprovedBy: 'approver-1',
};

describe('shouldShowExtraCancelHint', () => {
  it('28 — aprovador da parcela extra aprovada vê a dica', () => {
    expect(shouldShowExtraCancelHint(baseHint, 'approver-1', 'Coordinator')).toBe(true);
  });

  it('29 — Admin Master vê a dica', () => {
    expect(shouldShowExtraCancelHint(baseHint, 'am-9', 'Admin Master')).toBe(true);
  });

  it('30 — Financeiro sem ser aprovador não vê a dica', () => {
    expect(shouldShowExtraCancelHint(baseHint, 'fin-3', 'Financeiro')).toBe(false);
  });

  it('31 — parcela paga não exibe a dica', () => {
    expect(
      shouldShowExtraCancelHint({ ...baseHint, status: 'pago' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('32 — parcela de origem OS não exibe a dica', () => {
    expect(
      shouldShowExtraCancelHint({ ...baseHint, sourceType: 'maintenance_order' }, 'approver-1', 'Coordinator'),
    ).toBe(false);
  });

  it('33 — userId undefined retorna false', () => {
    expect(shouldShowExtraCancelHint(baseHint, undefined, 'Coordinator')).toBe(false);
  });
});

// ─── constantes (1) ────────────────────────────────────────────────────────

describe('constantes de cancelamento', () => {
  it('34 — constantes têm os valores e mensagens corretos', () => {
    expect(CANCELLATION_REASON_MAX_LENGTH).toBe(500);

    expect(CANCELLATION_REASON_INVALID_MESSAGE).toBe(
      'Informe um motivo de cancelamento com até 500 caracteres.',
    );
    expect(CANCELLATION_NOT_APPLIED_MESSAGE).toBe(
      'Não foi possível cancelar: o pagamento foi alterado ou você não tem permissão. Atualize a tela e tente novamente.',
    );
    expect(EXTRA_PAYMENT_INSTALLMENT_CANCEL_HINT).toBe(
      'Para cancelar esta parcela, cancele o pagamento extra na aba Pagamentos Extras.',
    );
    expect(CANCELLATION_IRREVERSIBLE_WARNING).toBe(
      'O cancelamento é definitivo e não estorna valores. Se este pagamento já foi feito no banco, trate o estorno fora do sistema.',
    );
  });
});
