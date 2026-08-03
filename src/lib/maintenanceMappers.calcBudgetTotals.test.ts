import { describe, it, expect } from 'vitest';

import { calcBudgetItemNet, calcBudgetTotals } from './maintenanceMappers';

import type { BudgetItem } from '../types/maintenance';

const makeItem = (quantity: number, value: number, discount?: number): BudgetItem => ({
  itemName: 'Item',
  system: 'Sistema',
  quantity,
  value,
  ...(discount !== undefined ? { discount } : {}),
  sortOrder: 0,
});

describe('calcBudgetItemNet', () => {
  it('returns gross when there is no discount', () => {
    expect(calcBudgetItemNet({ quantity: 2, value: 400, discount: 0 })).toBe(800);
  });

  it('returns gross minus discount', () => {
    expect(calcBudgetItemNet({ quantity: 2, value: 400, discount: 100 })).toBe(700);
  });

  it('clamps discount above line value to the line value (zero net)', () => {
    expect(calcBudgetItemNet({ quantity: 1, value: 100, discount: 250 })).toBe(0);
  });

  it('treats negative discount as zero', () => {
    expect(calcBudgetItemNet({ quantity: 1, value: 100, discount: -50 })).toBe(100);
  });

  it('treats missing discount as zero', () => {
    expect(calcBudgetItemNet({ quantity: 1, value: 100 })).toBe(100);
  });
});

describe('calcBudgetTotals', () => {
  it('sem desconto, total é igual ao subtotal', () => {
    const items = [makeItem(1, 780), makeItem(1, 220)];
    expect(calcBudgetTotals(items)).toEqual({ subtotal: 1000, itemsDiscount: 0, orderDiscount: 0, total: 1000 });
  });

  it('desconto por item reduz o total', () => {
    const items = [makeItem(2, 400, 100)];
    expect(calcBudgetTotals(items)).toEqual({ subtotal: 800, itemsDiscount: 100, orderDiscount: 0, total: 700 });
  });

  it('desconto geral reduz o total', () => {
    const items = [makeItem(1, 1000), makeItem(1, 500)];
    expect(calcBudgetTotals(items, 200).total).toBe(1300);
  });

  it('desconto por item maior que a linha é limitado ao valor da linha', () => {
    const items = [makeItem(1, 100, 250)];
    expect(calcBudgetTotals(items)).toEqual({ subtotal: 100, itemsDiscount: 100, orderDiscount: 0, total: 0 });
  });

  it('desconto geral maior que o subtotal é limitado ao subtotal', () => {
    const items = [makeItem(1, 500)];
    expect(calcBudgetTotals(items, 900)).toEqual({ subtotal: 500, itemsDiscount: 0, orderDiscount: 500, total: 0 });
  });

  it('desconto negativo é tratado como zero', () => {
    const items = [makeItem(1, 100, -50)];
    expect(calcBudgetTotals(items)).toEqual({ subtotal: 100, itemsDiscount: 0, orderDiscount: 0, total: 100 });
  });

  it('lista vazia', () => {
    expect(calcBudgetTotals([])).toEqual({ subtotal: 0, itemsDiscount: 0, orderDiscount: 0, total: 0 });
  });

  it('itens sem a propriedade `discount` (dados antigos) contam como desconto zero', () => {
    const items = [makeItem(1, 780), makeItem(1, 220)];
    expect(calcBudgetTotals(items, 100)).toEqual({ subtotal: 1000, itemsDiscount: 0, orderDiscount: 100, total: 900 });
  });
});