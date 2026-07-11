import { describe, it, expect } from 'vitest';

import { calcBudgetSubtotal } from './maintenanceMappers';

import type { BudgetItem } from '../types/maintenance';

const makeItem = (quantity: number, value: number): BudgetItem => ({
  itemName: 'Item',
  system: 'Sistema',
  quantity,
  value,
  sortOrder: 0,
});

describe('calcBudgetSubtotal', () => {
  it('sums quantity * value across multiple items (OS-2607-1638: 780 + 70 + 220 + 300 = 1370)', () => {
    const items = [makeItem(1, 780), makeItem(1, 70), makeItem(1, 220), makeItem(1, 300)];
    expect(calcBudgetSubtotal(items)).toBe(1370);
  });

  it('returns 0 for an empty list', () => {
    expect(calcBudgetSubtotal([])).toBe(0);
  });

  it('handles decimal quantities and values', () => {
    const items = [makeItem(2.5, 10.4), makeItem(1.25, 8)];
    expect(calcBudgetSubtotal(items)).toBeCloseTo(2.5 * 10.4 + 1.25 * 8);
  });
});
