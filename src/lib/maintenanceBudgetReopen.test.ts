import { describe, expect, it } from 'vitest';

import {
  BUDGET_REOPEN_ROLES,
  canReopenBudget,
  isBudgetDiscountLocked,
  isBudgetUnderRevision,
  shouldResubmitReopenedBudget,
} from './maintenanceBudgetReopen';

describe('BUDGET_REOPEN_ROLES', () => {
  it('espelha a allowlist da policy de INSERT mais Admin Master', () => {
    expect([...BUDGET_REOPEN_ROLES]).toEqual([
      'Fleet Assistant',
      'Fleet Analyst',
      'Supervisor',
      'Manager',
      'Coordinator',
      'Director',
      'Admin Master',
    ]);
  });

  it('não inclui Workshop', () => {
    expect(BUDGET_REOPEN_ROLES).not.toContain('Workshop');
  });
});

describe('canReopenBudget', () => {
  it('cenário feliz: orçamento reprovado + Fleet Assistant + conta de cliente', () => {
    expect(canReopenBudget('reprovado', 'Fleet Assistant', false)).toBe(true);
  });

  it('libera todos os papéis da allowlist', () => {
    for (const role of BUDGET_REOPEN_ROLES) {
      expect(canReopenBudget('reprovado', role, false)).toBe(true);
    }
  });

  it('CRÍTICO: orçamento aprovado nunca é reabrível, nem por Admin Master', () => {
    expect(canReopenBudget('aprovado', 'Admin Master', false)).toBe(false);
  });

  it('conta de oficina não reabre, mesmo com orçamento reprovado', () => {
    expect(canReopenBudget('reprovado', 'Workshop', true)).toBe(false);
  });

  it('o papel Workshop sozinho já barra, mesmo fora de conta de oficina', () => {
    expect(canReopenBudget('reprovado', 'Workshop', false)).toBe(false);
  });

  it('papéis fora da allowlist não reabrem', () => {
    expect(canReopenBudget('reprovado', 'Driver', false)).toBe(false);
    expect(canReopenBudget('reprovado', 'Operations Manager', false)).toBe(false);
    expect(canReopenBudget('reprovado', 'Yard Auditor', false)).toBe(false);
    expect(canReopenBudget('reprovado', 'Financeiro', false)).toBe(false);
  });

  it('edge cases: qualquer origem diferente de reprovado é recusada', () => {
    expect(canReopenBudget('pendente', 'Fleet Assistant', false)).toBe(false);
    expect(canReopenBudget('sem_orcamento', 'Fleet Assistant', false)).toBe(false);
    expect(canReopenBudget('reaberto', 'Fleet Assistant', false)).toBe(false);
    expect(canReopenBudget(undefined, 'Fleet Assistant', false)).toBe(false);
    expect(canReopenBudget(null, 'Fleet Assistant', false)).toBe(false);
  });

  it('edge cases: papel ausente é recusado', () => {
    expect(canReopenBudget('reprovado', undefined, false)).toBe(false);
    expect(canReopenBudget('reprovado', null, false)).toBe(false);
    expect(canReopenBudget('reprovado', '', false)).toBe(false);
  });
});

describe('isBudgetUnderRevision', () => {
  it('true apenas para reaberto', () => {
    expect(isBudgetUnderRevision('reaberto')).toBe(true);
  });

  it('false para todos os demais valores', () => {
    expect(isBudgetUnderRevision('sem_orcamento')).toBe(false);
    expect(isBudgetUnderRevision('pendente')).toBe(false);
    expect(isBudgetUnderRevision('aprovado')).toBe(false);
    expect(isBudgetUnderRevision('reprovado')).toBe(false);
    expect(isBudgetUnderRevision(undefined)).toBe(false);
    expect(isBudgetUnderRevision(null)).toBe(false);
  });
});

describe('shouldResubmitReopenedBudget', () => {
  it('cenário feliz: reaberto com itens e PDF volta para a fila', () => {
    expect(shouldResubmitReopenedBudget({
      budgetStatus: 'reaberto',
      hasSignificantItems: true,
      hasBudgetPdf: true,
    })).toBe(true);
  });

  it('sem itens significativos não reenvia', () => {
    expect(shouldResubmitReopenedBudget({
      budgetStatus: 'reaberto',
      hasSignificantItems: false,
      hasBudgetPdf: true,
    })).toBe(false);
  });

  it('sem PDF não reenvia', () => {
    expect(shouldResubmitReopenedBudget({
      budgetStatus: 'reaberto',
      hasSignificantItems: true,
      hasBudgetPdf: false,
    })).toBe(false);
  });

  it('estado diferente de reaberto nunca reenvia', () => {
    expect(shouldResubmitReopenedBudget({
      budgetStatus: 'reprovado',
      hasSignificantItems: true,
      hasBudgetPdf: true,
    })).toBe(false);
    expect(shouldResubmitReopenedBudget({
      budgetStatus: 'aprovado',
      hasSignificantItems: true,
      hasBudgetPdf: true,
    })).toBe(false);
    expect(shouldResubmitReopenedBudget({
      budgetStatus: 'pendente',
      hasSignificantItems: true,
      hasBudgetPdf: true,
    })).toBe(false);
    expect(shouldResubmitReopenedBudget({
      budgetStatus: undefined,
      hasSignificantItems: true,
      hasBudgetPdf: true,
    })).toBe(false);
  });
});

describe('isBudgetDiscountLocked', () => {
  it('só orçamento aprovado trava o desconto', () => {
    expect(isBudgetDiscountLocked('aprovado')).toBe(true);
  });

  it('reprovado e reaberto deixam o desconto editável', () => {
    expect(isBudgetDiscountLocked('reprovado')).toBe(false);
    expect(isBudgetDiscountLocked('reaberto')).toBe(false);
  });

  it('demais estados não travam', () => {
    expect(isBudgetDiscountLocked('pendente')).toBe(false);
    expect(isBudgetDiscountLocked('sem_orcamento')).toBe(false);
    expect(isBudgetDiscountLocked(undefined)).toBe(false);
    expect(isBudgetDiscountLocked(null)).toBe(false);
  });
});
