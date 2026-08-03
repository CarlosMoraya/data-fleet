/**
 * BudgetItemsTable component tests.
 *
 * Uses react-dom/client for rendering in jsdom (no Testing Library).
 * Verifies that the editable table renders Sistema as a select dropdown
 * and the readOnly table renders system as plain text.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BUDGET_SYSTEM_OPTIONS } from '../lib/budgetSystems';

import BudgetItemsTable from './BudgetItemsTable';

import type { BudgetItem } from '../lib/maintenanceMappers';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
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
    expect((selects[0]).value).toBe('Sistema de Freio');

    // Options should include all BUDGET_SYSTEM_OPTIONS plus the placeholder
    const options = selects[0].querySelectorAll('option');
    expect(options.length).toBe(BUDGET_SYSTEM_OPTIONS.length + 1); // +1 for "Selecione..."
    expect((options[0]).value).toBe('');
    expect((options[0]).textContent).toBe('Selecione...');
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
      (selects[0]).value = 'Motor';
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

  it('editable table renders the Desc. (R$) column header', () => {
    renderWithAct(
      <BudgetItemsTable items={sampleItems} readOnly={false} onChange={() => {}} />
    );

    const headers = Array.from(container.querySelectorAll('th')).map(th => th.textContent);
    expect(headers.some(h => h?.includes('Desc. (R$)'))).toBe(true);
  });

  it('disables item discount inputs when there is a general discount', () => {
    renderWithAct(
      <BudgetItemsTable
        items={sampleItems}
        readOnly={false}
        onChange={() => {}}
        orderDiscount={100}
        onOrderDiscountChange={() => {}}
      />
    );

    // Number inputs for item discount sit in the 5th cell of each row.
    // Identify them by their placeholder "0,00" plus being type=number — but quantity/
    // value also use number inputs, so locate by column index instead.
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      // cells: 0 Item, 1 Sistema, 2 Qtd, 3 Valor, 4 Desc, 5 Total, 6 trash
      const discountInput = cells[4]?.querySelector('input[type="number"]') as HTMLInputElement | null;
      expect(discountInput).not.toBeNull();
      expect(discountInput!.disabled).toBe(true);
    });
  });

  it('disables the general discount field when some item has a discount', () => {
    const itemsWithDiscount: BudgetItem[] = [
      { itemName: 'Pastilha', system: 'Sistema de Freio', quantity: 1, value: 100, discount: 50, sortOrder: 0 },
      { itemName: 'Bateria', system: 'Sistema Elétrico', quantity: 1, value: 200, sortOrder: 1 },
    ];

    renderWithAct(
      <BudgetItemsTable
        items={itemsWithDiscount}
        readOnly={false}
        onChange={() => {}}
        orderDiscount={0}
        onOrderDiscountChange={() => {}}
      />
    );

    const labels = Array.from(container.querySelectorAll('label'));
    const generalLabel = labels.find((l) => l.textContent?.includes('Desconto geral (R$)'));
    const generalInput = generalLabel?.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(generalInput).not.toBeNull();
    expect(generalInput!.disabled).toBe(true);
  });

  it('renders the Discount row and net Total in the editable footer when there is a general discount', () => {
    const items: BudgetItem[] = [
      { itemName: 'Item', system: 'Motor', quantity: 1, value: 1000, sortOrder: 0 },
    ];

    renderWithAct(
      <BudgetItemsTable
        items={items}
        readOnly={false}
        onChange={() => {}}
        orderDiscount={200}
        onOrderDiscountChange={() => {}}
      />
    );

    const footerText = container.textContent ?? '';
    // Net total = 1000 − 200 = 800
    expect(footerText).toContain('800,00');
    expect(footerText).toContain('Desconto');
  });

  it('discountsLocked disables both item discount and general discount inputs', () => {
    renderWithAct(
      <BudgetItemsTable
        items={sampleItems}
        readOnly={false}
        onChange={() => {}}
        orderDiscount={0}
        onOrderDiscountChange={() => {}}
        discountsLocked
      />
    );

    const rows = container.querySelectorAll('tbody tr');
    const firstRowCells = rows[0].querySelectorAll('td');
    const itemDiscountInput = firstRowCells[4]?.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(itemDiscountInput).not.toBeNull();
    expect(itemDiscountInput!.disabled).toBe(true);

    const labels = Array.from(container.querySelectorAll('label'));
    const generalLabel = labels.find((l) => l.textContent?.includes('Desconto geral (R$)'));
    const generalInput = generalLabel?.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(generalInput).not.toBeNull();
    expect(generalInput!.disabled).toBe(true);
  });
});