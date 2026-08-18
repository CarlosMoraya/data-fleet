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

function fireKey(target: HTMLElement, key: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

function StatefulDropdown({ initialSelected = [] as string[] }) {
  const [selected, setSelected] = React.useState<string[]>(initialSelected);
  return (
    <MultiSelectDropdown
      label="Status"
      options={['A', 'B', 'C']}
      selected={selected}
      onChange={setSelected}
    />
  );
}

describe('MultiSelectDropdown', () => {
  it('mantém compatibilidade com options string[]', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B', 'C']} selected={[]} onChange={onChange} />,
    );

    openPanel();

    const option = container.querySelector('[role="option"]');
    act(() => {
      (option as HTMLElement).click();
    });

    expect(onChange).toHaveBeenCalledWith(['A']);
  });

  it('exibe label diferente de value em opções objeto e retorna values em onChange', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown
        label="Embarcador"
        options={[{ value: 's1', label: 'Embarcador Alpha' }]}
        selected={[]}
        onChange={onChange}
      />,
    );

    openPanel();

    const option = container.querySelector('[role="option"]');
    expect(option?.textContent).toContain('Embarcador Alpha');
    expect(option?.textContent).not.toContain('s1');

    act(() => {
      (option as HTMLElement).click();
    });

    expect(onChange).toHaveBeenCalledWith(['s1']);
  });

  it('clique alterna múltiplas opções sem fechar', () => {
    renderWithAct(<StatefulDropdown />);

    openPanel();

    const options = Array.from(container.querySelectorAll('[role="option"]'));
    act(() => {
      (options[0] as HTMLElement).click();
    });
    act(() => {
      (options[1] as HTMLElement).click();
    });

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(options[0].getAttribute('aria-checked')).toBe('true');
    expect(options[1].getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('button[aria-haspopup="listbox"]')?.textContent).toContain('(2)');
  });

  it('Selecionar todos respeita ordem e values das opções objeto', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown
        label="Status"
        options={[
          { value: 'b', label: 'B' },
          { value: 'a', label: 'A' },
        ]}
        selected={[]}
        onChange={onChange}
      />,
    );

    openPanel();

    const buttons = Array.from(container.querySelectorAll('button'));
    const selectAll = buttons.find((button) => button.textContent === 'Selecionar todos');
    act(() => {
      selectAll?.click();
    });

    expect(onChange).toHaveBeenCalledWith(['b', 'a']);
  });

  it('Limpar seleção retorna array vazio', () => {
    const onChange = vi.fn();
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B']} selected={['A', 'B']} onChange={onChange} />,
    );

    openPanel();

    const buttons = Array.from(container.querySelectorAll('button'));
    const clearSelection = buttons.find((button) => button.textContent === 'Limpar seleção');
    act(() => {
      clearSelection?.click();
    });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Enter e Espaço alternam a opção', () => {
    renderWithAct(<StatefulDropdown />);

    openPanel();

    const first = container.querySelector('[role="option"]') as HTMLElement;
    fireKey(first, 'Enter');
    expect(first.getAttribute('aria-checked')).toBe('true');

    fireKey(first, ' ');
    expect(first.getAttribute('aria-checked')).toBe('false');
  });

  it('setas, Home e End movem o foco entre as opções', () => {
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B', 'C']} selected={[]} onChange={() => {}} />,
    );

    openPanel();

    const options = Array.from(container.querySelectorAll('[role="option"]')) as HTMLElement[];
    expect(document.activeElement).toBe(options[0]);

    fireKey(options[0], 'ArrowDown');
    expect(document.activeElement).toBe(options[1]);

    fireKey(options[1], 'ArrowUp');
    expect(document.activeElement).toBe(options[0]);

    fireKey(options[0], 'End');
    expect(document.activeElement).toBe(options[2]);

    fireKey(options[2], 'Home');
    expect(document.activeElement).toBe(options[0]);
  });

  it('Escape fecha e devolve o foco ao gatilho', () => {
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B']} selected={[]} onChange={() => {}} />,
    );

    openPanel();

    const option = container.querySelector('[role="option"]') as HTMLElement;
    fireKey(option, 'Escape');

    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('button[aria-haspopup="listbox"]'));
  });

  it('expõe listbox multisseleção e aria-checked', () => {
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A', 'B']} selected={['A']} onChange={() => {}} />,
    );

    openPanel();

    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-multiselectable')).toBe('true');

    const selectedOption = Array.from(container.querySelectorAll('[role="option"]'))
      .find((option) => option.getAttribute('aria-checked') === 'true');
    expect(selectedOption).not.toBeNull();
    expect(selectedOption?.getAttribute('aria-selected')).toBeNull();
  });

  it('disabled impede a abertura do painel', () => {
    renderWithAct(
      <MultiSelectDropdown label="Status" options={['A']} selected={[]} onChange={() => {}} disabled />,
    );

    const button = container.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    act(() => {
      button.click();
    });

    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('estado vazio exibe emptyLabel', () => {
    renderWithAct(
      <MultiSelectDropdown
        label="Status"
        options={[]}
        selected={[]}
        onChange={() => {}}
        emptyLabel="Sem opções disponíveis"
      />,
    );

    openPanel();

    expect(container.textContent).toContain('Sem opções disponíveis');
    expect(container.querySelector('[role="option"]')).toBeNull();
  });
});
