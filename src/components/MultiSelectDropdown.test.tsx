import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MultiSelectDropdown from './MultiSelectDropdown';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

function openPanel() {
  const button = container.querySelector('button[aria-haspopup="listbox"]');
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

describe('MultiSelectDropdown', () => {
  it('renders the button with the label and opens the panel on click', () => {
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B', 'C']} selected={[]} onChange={() => {}} />,
    );

    const button = container.querySelector('button[aria-haspopup="listbox"]');
    expect(button?.textContent).toContain('Status');
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    openPanel();

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it('calls onChange with all options when clicking "Selecionar todos"', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B', 'C']} selected={[]} onChange={onChange} />,
    );

    openPanel();

    const buttons = Array.from(container.querySelectorAll('button'));
    const selectAll = buttons.find(b => b.textContent === 'Selecionar todos');
    act(() => {
      selectAll?.click();
    });

    expect(onChange).toHaveBeenCalledWith(['A', 'B', 'C']);
  });

  it('calls onChange with an empty array when clicking "Limpar seleção"', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B', 'C']} selected={['A', 'B']} onChange={onChange} />,
    );

    openPanel();

    const buttons = Array.from(container.querySelectorAll('button'));
    const clearSelection = buttons.find(b => b.textContent === 'Limpar seleção');
    act(() => {
      clearSelection?.click();
    });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('still toggles an individual option, adding it to the selection', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B', 'C']} selected={['A']} onChange={onChange} />,
    );

    openPanel();

    const option = container.querySelector('[role="option"]:not([aria-selected="true"])');
    act(() => {
      (option as HTMLElement).click();
    });

    expect(onChange).toHaveBeenCalledWith(['A', 'B']);
  });

  it('disables "Selecionar todos" when all options are already selected', () => {
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B']} selected={['A', 'B']} onChange={() => {}} />,
    );

    openPanel();

    const buttons = Array.from(container.querySelectorAll('button'));
    const selectAll = buttons.find(b => b.textContent === 'Selecionar todos') as HTMLButtonElement;
    expect(selectAll.disabled).toBe(true);
  });
});
