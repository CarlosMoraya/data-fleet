import { describe, expect, it } from 'vitest';

import { EXTRA_PAYMENT_STATUS_LABELS, PAYMENT_INSTALLMENT_STATUS_LABELS } from './paymentStatusDisplay';

describe('paymentStatusDisplay', () => {
  it('PAYMENT_INSTALLMENT_STATUS_LABELS traz "Lançado no sistema" para o status pago', () => {
    expect(PAYMENT_INSTALLMENT_STATUS_LABELS).toEqual({
      pendente_aprovacao: 'Pendente de aprovação',
      aprovado: 'Aprovado',
      reprovado: 'Reprovado',
      pago: 'Lançado no sistema',
    });
  });

  it('EXTRA_PAYMENT_STATUS_LABELS traz "Lançado no sistema" para o status pago', () => {
    expect(EXTRA_PAYMENT_STATUS_LABELS).toEqual({
      pendente_aprovacao: 'Pendente de aprovação',
      aprovado: 'Aprovado',
      reprovado: 'Reprovado',
      pago: 'Lançado no sistema',
      cancelado: 'Cancelado',
    });
  });
});
