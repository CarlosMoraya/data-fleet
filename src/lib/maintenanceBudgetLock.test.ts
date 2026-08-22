import { describe, expect, it } from 'vitest';

import { isApprovedBudgetLocked } from './maintenanceBudgetLock';

describe('isApprovedBudgetLocked', () => {
  it('trava o orçamento somente quando aprovado', () => {
    expect(isApprovedBudgetLocked('aprovado')).toBe(true);
    expect(isApprovedBudgetLocked('pendente')).toBe(false);
    expect(isApprovedBudgetLocked('reprovado')).toBe(false);
    expect(isApprovedBudgetLocked('sem_orcamento')).toBe(false);
    expect(isApprovedBudgetLocked(undefined)).toBe(false);
    expect(isApprovedBudgetLocked(null)).toBe(false);
  });
});
