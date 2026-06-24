import { describe, it, expect } from 'vitest';

import { isKnownBudgetSystem } from '../lib/budgetSystems';

import type { BudgetItem } from '../lib/maintenanceMappers';

/**
 * hasBudgetItemWithoutSystem — mirrors the helper defined in MaintenanceForm.tsx.
 * Tested in isolation to ensure the validation logic is correct.
 */
function hasBudgetItemWithoutSystem(items: BudgetItem[]): boolean {
  return items.some(item => item.itemName.trim().length > 0 && !isKnownBudgetSystem(item.system));
}

describe('hasBudgetItemWithoutSystem', () => {
  it('returns false for empty rows', () => {
    expect(hasBudgetItemWithoutSystem([])).toBe(false);
  });

  it('returns false for row with no itemName (insignificant)', () => {
    const items: BudgetItem[] = [
      { itemName: '', system: '', quantity: 1, value: 0, sortOrder: 0 },
    ];
    expect(hasBudgetItemWithoutSystem(items)).toBe(false);
  });

  it('returns true for named item without system', () => {
    const items: BudgetItem[] = [
      { itemName: 'Pastilha de freio', system: '', quantity: 1, value: 100, sortOrder: 0 },
    ];
    expect(hasBudgetItemWithoutSystem(items)).toBe(true);
  });

  it('returns true for named item with unknown system', () => {
    const items: BudgetItem[] = [
      { itemName: 'Peça genérica', system: 'Sistema Inventado', quantity: 1, value: 50, sortOrder: 0 },
    ];
    expect(hasBudgetItemWithoutSystem(items)).toBe(true);
  });

  it('returns false for named item with Outros', () => {
    const items: BudgetItem[] = [
      { itemName: 'Serviço diverso', system: 'Outros', quantity: 1, value: 200, sortOrder: 0 },
    ];
    expect(hasBudgetItemWithoutSystem(items)).toBe(false);
  });

  it('returns false for named item with known system', () => {
    const items: BudgetItem[] = [
      { itemName: 'Pastilha de freio', system: 'Sistema de Freio', quantity: 2, value: 180, sortOrder: 0 },
    ];
    expect(hasBudgetItemWithoutSystem(items)).toBe(false);
  });

  it('returns true when at least one named item lacks system among valid ones', () => {
    const items: BudgetItem[] = [
      { itemName: 'Pastilha de freio', system: 'Sistema de Freio', quantity: 2, value: 180, sortOrder: 0 },
      { itemName: 'Serviço desconhecido', system: '', quantity: 1, value: 50, sortOrder: 1 },
    ];
    expect(hasBudgetItemWithoutSystem(items)).toBe(true);
  });
});