import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SearchableSelect from './SearchableSelect';

import type { SearchableSelectProps } from './SearchableSelect';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;

const options = [
  { value: 'one', label: 'Primeira opção' },
  { value: 'two', label: 'Segunda opção' },
  { value: 'three', label: 'Terceira opção' },
];

async function waitForAssertion(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

function renderSelect(overrides: Partial<SearchableSelectProps> = {}) {
  const props: SearchableSelectProps = {
    options,
    value: '',
    onChange: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    ariaLabel: 'Escolher opção',
    ...overrides,
  };
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => root.render(<SearchableSelect {...props} />));
  return props;
}

function getInput(): HTMLInputElement {
  const input = container.querySelector('input');
  if (!(input instanceof HTMLInputElement)) throw new Error('Input não encontrado');
  return input;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('SearchableSelect', () => {
  it('abre a lista com três opções ao clicar no input', () => {
    renderSelect();
    act(() => getInput().click());

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
  });

  it('envia o texto digitado para onQueryChange', () => {
    const props = renderSelect();
    const input = getInput();
    act(() => input.click());
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ) as { set?: (this: HTMLInputElement, value: string) => void } | undefined;
    act(() => {
      valueDescriptor?.set?.call(input, 'oficina');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(props.onQueryChange).toHaveBeenCalledWith('oficina');
  });

  it('seleciona por clique e fecha a lista', () => {
    const props = renderSelect();
    act(() => getInput().click());
    const secondOption = container.querySelectorAll('[role="option"]')[1] as HTMLElement;
    act(() => secondOption.click());

    expect(props.onChange).toHaveBeenCalledWith('two');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('seleciona a primeira opção com ArrowDown e Enter', () => {
    const props = renderSelect();
    const input = getInput();
    act(() => input.click());
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(props.onChange).toHaveBeenCalledWith('one');
  });

  it('fecha com Escape e devolve o foco ao input', async () => {
    renderSelect();
    const input = getInput();
    act(() => input.click());
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement).toBe(input);
    });
  });

  it('renderiza o estado vazio sem opções interativas', () => {
    renderSelect({ options: [], emptyLabel: 'Nada encontrado' });
    act(() => getInput().click());

    expect(container.textContent).toContain('Nada encontrado');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });

  it('expõe os atributos de acessibilidade do combobox', () => {
    renderSelect();
    const input = getInput();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-label')).toBe('Escolher opção');

    act(() => input.click());
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('não abre quando está desabilitado', () => {
    renderSelect({ disabled: true });
    act(() => getInput().click());
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});
