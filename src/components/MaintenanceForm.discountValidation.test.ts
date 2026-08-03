import { describe, it, expect } from 'vitest';

import { validateBudgetDiscounts } from './MaintenanceForm';

import type { BudgetItem } from '../types/maintenance';

const item = (over: Partial<BudgetItem>): BudgetItem => ({
  itemName: 'Item',
  system: 'Motor',
  quantity: 1,
  value: 1000,
  sortOrder: 0,
  ...over,
});

describe('validateBudgetDiscounts', () => {
  it('orçamento sem desconto é válido', () => {
    expect(validateBudgetDiscounts([item({ discount: 0 })], 0)).toBeNull();
  });

  it('desconto de item acima do valor da linha retorna mensagem citando o nome do item', () => {
    const items = [item({ itemName: 'Pastilha', quantity: 1, value: 100, discount: 250 })];
    const result = validateBudgetDiscounts(items, 0);
    expect(result).not.toBeNull();
    expect(result).toContain('Pastilha');
  });

  it('desconto negativo retorna mensagem de negativo', () => {
    expect(validateBudgetDiscounts([item({ discount: -50 })], 0)).toContain('não pode ser negativo');
    expect(validateBudgetDiscounts([item({ discount: 0 })], -10)).toContain('não pode ser negativo');
  });

  it('desconto por item e geral ao mesmo tempo retorna mensagem de exclusividade', () => {
    const items = [item({ quantity: 1, value: 1000, discount: 50 })];
    expect(validateBudgetDiscounts(items, 100)).toContain('nunca os dois');
  });

  it('desconto geral acima do subtotal retorna mensagem de subtotal', () => {
    const items = [item({ quantity: 1, value: 500, discount: 0 })];
    expect(validateBudgetDiscounts(items, 600)).toContain('não pode ser maior que o subtotal');
  });

  it('desconto por item exatamente igual ao valor da linha é válido', () => {
    expect(validateBudgetDiscounts([item({ quantity: 1, value: 100, discount: 100 })], 0)).toBeNull();
  });
});