import { describe, expect, it } from 'vitest';

import {
  canTransitionStatus,
  exceedsBudget,
  generateInstallmentDrafts,
  remainingBudget,
  splitInstallmentValue,
  sumInstallmentsValue,
  sumNonRejectedValue,
} from './paymentInstallments';

describe('splitInstallmentValue', () => {
  it('divide 20000 em 3 parcelas cuja soma é exatamente 20000', () => {
    const values = splitInstallmentValue(20000, 3);

    expect(values).toHaveLength(3);
    const sum = values.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100)).toBe(Math.round(20000 * 100));
  });

  it('joga o resto do arredondamento na última parcela', () => {
    const values = splitInstallmentValue(20000, 3);

    // 6666.66 + 6666.66 + 6666.68 = 20000
    expect(values[0]).toBeCloseTo(6666.66, 2);
    expect(values[1]).toBeCloseTo(6666.66, 2);
    expect(values[2]).toBeCloseTo(6666.68, 2);
  });

  it('divide 50000 em 10 parcelas iguais de 5000', () => {
    const values = splitInstallmentValue(50000, 10);

    expect(values).toHaveLength(10);
    for (const v of values) {
      expect(v).toBe(5000);
    }
  });

  it('count=1 devolve o próprio total', () => {
    expect(splitInstallmentValue(20000, 1)).toEqual([20000]);
  });

  it('count<=0 devolve lista vazia', () => {
    expect(splitInstallmentValue(20000, 0)).toEqual([]);
    expect(splitInstallmentValue(20000, -1)).toEqual([]);
  });
});

describe('generateInstallmentDrafts', () => {
  it('gera vencimentos mensais (+1 mês)', () => {
    const drafts = generateInstallmentDrafts({
      total: 30000,
      count: 3,
      firstDueDate: '2026-01-15',
      interval: 'mensal',
    });

    expect(drafts).toHaveLength(3);
    expect(drafts.map((d) => d.dueDate)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(drafts.map((d) => d.installmentNumber)).toEqual([1, 2, 3]);
  });

  it('gera vencimentos quinzenais (+15d)', () => {
    const drafts = generateInstallmentDrafts({
      total: 30000,
      count: 3,
      firstDueDate: '2026-01-15',
      interval: 'quinzenal',
    });

    expect(drafts.map((d) => d.dueDate)).toEqual([
      '2026-01-15',
      '2026-01-30',
      '2026-02-14',
    ]);
  });

  it('gera vencimentos semanais (+7d)', () => {
    const drafts = generateInstallmentDrafts({
      total: 30000,
      count: 3,
      firstDueDate: '2026-01-15',
      interval: 'semanal',
    });

    expect(drafts.map((d) => d.dueDate)).toEqual([
      '2026-01-15',
      '2026-01-22',
      '2026-01-29',
    ]);
  });

  it('distribui os valores via splitInstallmentValue', () => {
    const drafts = generateInstallmentDrafts({
      total: 50000,
      count: 10,
      firstDueDate: '2026-01-15',
      interval: 'mensal',
    });

    expect(drafts.every((d) => d.value === 5000)).toBe(true);
  });
});

describe('canTransitionStatus', () => {
  it('permite pendente_aprovacao → aprovado', () => {
    expect(canTransitionStatus('pendente_aprovacao', 'aprovado')).toBe(true);
  });

  it('permite pendente_aprovacao → reprovado', () => {
    expect(canTransitionStatus('pendente_aprovacao', 'reprovado')).toBe(true);
  });

  it('permite aprovado → pago', () => {
    expect(canTransitionStatus('aprovado', 'pago')).toBe(true);
  });

  it('bloqueia pendente_aprovacao → pago', () => {
    expect(canTransitionStatus('pendente_aprovacao', 'pago')).toBe(false);
  });

  it('bloqueia reprovado → pago', () => {
    expect(canTransitionStatus('reprovado', 'pago')).toBe(false);
  });

  it('bloqueia aprovado → reprovado', () => {
    expect(canTransitionStatus('aprovado', 'reprovado')).toBe(false);
  });

  it('bloqueia pago → qualquer', () => {
    expect(canTransitionStatus('pago', 'aprovado')).toBe(false);
    expect(canTransitionStatus('pago', 'pendente_aprovacao')).toBe(false);
  });
});

describe('sumInstallmentsValue / remainingBudget', () => {
  it('soma os valores da lista', () => {
    expect(sumInstallmentsValue([{ value: 5000 }, { value: 5000 }])).toBe(10000);
  });

  it('remainingBudget devolve o saldo restante', () => {
    expect(remainingBudget(20000, [{ value: 5000 }, { value: 5000 }])).toBe(10000);
  });

  it('remainingBudget fica negativo quando a soma excede o aprovado', () => {
    expect(remainingBudget(10000, [{ value: 8000 }, { value: 5000 }])).toBe(-3000);
  });
});

describe('exceedsBudget', () => {
  it('retorna false quando a soma é menor que o saldo', () => {
    expect(exceedsBudget(999.99, 1000)).toBe(false);
  });

  it('retorna false quando a soma é exatamente igual ao saldo com resíduo de float', () => {
    const values = splitInstallmentValue(5936.08, 10);
    const sum = sumInstallmentsValue(values.map((value) => ({ value })));

    expect(sum).toBeGreaterThan(5936.08);
    expect(exceedsBudget(sum, 5936.08)).toBe(false);
  });

  it('retorna true quando a soma excede o saldo em 1 centavo', () => {
    expect(exceedsBudget(1000.01, 1000)).toBe(true);
  });
});

describe('sumNonRejectedValue / remainingBudget (reprovadas liberam saldo)', () => {
  it('sumNonRejectedValue ignora parcelas reprovadas', () => {
    expect(
      sumNonRejectedValue([
        { value: 400, status: 'reprovado' },
        { value: 600, status: 'pendente_aprovacao' },
      ]),
    ).toBe(600);
  });

  it('sumNonRejectedValue soma drafts sem status', () => {
    expect(sumNonRejectedValue([{ value: 100 }, { value: 200 }])).toBe(300);
  });

  it('remainingBudget desconsidera reprovadas na soma', () => {
    expect(
      remainingBudget(1000, [
        { value: 400, status: 'reprovado' },
        { value: 600, status: 'aprovado' },
      ]),
    ).toBe(400);
  });

  it('remainingBudget com lista vazia devolve o total aprovado', () => {
    expect(remainingBudget(1000, [])).toBe(1000);
  });
});
