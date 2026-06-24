import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import PeriodRangeFilter from './PeriodRangeFilter';

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

function dateInputs() {
  return Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
}

describe('PeriodRangeFilter', () => {
  it('renders the selected range and analysis title', () => {
    renderWithAct(
      <PeriodRangeFilter
        value={{ from: '2026-06-01', to: '2026-06-30' }}
        onChange={() => {}}
        onReset={() => {}}
      />
    );

    const [fromInput, toInput] = dateInputs();

    expect(container.textContent).toContain('Período de análise');
    expect(fromInput.value).toBe('2026-06-01');
    expect(toInput.value).toBe('2026-06-30');
  });

  it('changes the initial date preserving the final date and resets on button click', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    renderWithAct(
      <PeriodRangeFilter
        value={{ from: '2026-06-01', to: '2026-06-30' }}
        onChange={onChange}
        onReset={onReset}
      />
    );

    const [fromInput] = dateInputs();
    const resetButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Mês atual'
    );

    act(() => {
      setInputValue(fromInput, '2026-06-10');
      fromInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith({ from: '2026-06-10', to: '2026-06-30' });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders equal from/to dates with matching min and max limits', () => {
    renderWithAct(
      <PeriodRangeFilter
        value={{ from: '2026-06-15', to: '2026-06-15' }}
        onChange={() => {}}
        onReset={() => {}}
      />
    );

    const [fromInput, toInput] = dateInputs();

    expect(fromInput.max).toBe('2026-06-15');
    expect(toInput.min).toBe('2026-06-15');
  });
});
