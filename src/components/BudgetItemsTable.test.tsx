/**
 * BudgetItemsTable component tests.
 *
 * Uses react-dom/client for rendering in jsdom (no Testing Library).
 * Verifies that the editable table renders Sistema as a select dropdown
 * and the readOnly table renders system as plain text.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import BudgetItemsTable from './BudgetItemsTable';
import type { BudgetItem } from '../lib/maintenanceMappers';
import { BUDGET_SYSTEM_OPTIONS } from '../lib/budgetSystems';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as any).__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as any).__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

const sampleItems: BudgetItem[] = [
  { itemName: 'Pastilha de freio', system: 'Sistema de Freio', quantity: 2, value: 180, sortOrder: 0 },
  { itemName: 'Bateria 12V', system: 'Sistema Elétrico', quantity: 1, value: 350, sortOrder: 1 },
];

describe('BudgetItemsTable', () => {
  it('editable table renders Sistema as select instead of free text input', () => {
    const onChange = () => {};
    renderWithAct(
      <BudgetItemsTable items={sampleItems} readOnly={false} onChange={onChange} />
    );

    // There should be at least one <select> for the Sistema column
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(sampleItems.length);

    // There should be NO text input whose value matches a system value
    const textInputs = container.querySelectorAll('input[type="text"]');
    const systemInputs = Array.from(textInputs).filter(input => {
      const val = (input as HTMLInputElement).value;
      return BUDGET_SYSTEM_OPTIONS.includes(val);
    });
    expect(systemInputs.length).toBe(0);

    // The first select should have the correct value
    expect((selects[0] as HTMLSelectElement).value).toBe('Sistema de Freio');

    // Options should include all BUDGET_SYSTEM_OPTIONS plus the placeholder
    const options = selects[0].querySelectorAll('option');
    expect(options.length).toBe(BUDGET_SYSTEM_OPTIONS.length + 1); // +1 for "Selecione..."
    expect((options[0] as HTMLOptionElement).value).toBe('');
    expect((options[0] as HTMLOptionElement).textContent).toBe('Selecione...');
  });

  it('system select calls onChange with selected official value', () => {
    const changes: BudgetItem[][] = [];
    const onChange = (items: BudgetItem[]) => { changes.push(items); };

    renderWithAct(
      <BudgetItemsTable items={sampleItems} readOnly={false} onChange={onChange} />
    );

    const selects = container.querySelectorAll('select');
    act(() => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { value: selects[0], writable: false });
      (selects[0] as HTMLSelectElement).value = 'Motor';
      selects[0].dispatchEvent(event);
    });

    expect(changes.length).toBeGreaterThanOrEqual(1);
    const lastChange = changes[changes.length - 1];
    expect(lastChange[0].system).toBe('Motor');
  });

  it('readOnly table still renders system as text', () => {
    renderWithAct(
      <BudgetItemsTable items={sampleItems} readOnly={true} />
    );

    // In readOnly mode, there should be no <select> for system
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBe(0);

    // System text should appear in table cells
    const cells = container.querySelectorAll('td');
    const texts = Array.from(cells).map(td => td.textContent);
    expect(texts).toContain('Sistema de Freio');
  });
});