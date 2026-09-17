import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SortableHeader from './SortableHeader';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;

function renderSortableHeader(label: string, direction: 'asc' | 'desc' | null, onSort: () => void, className?: string) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() =>
    root.render(
      <table>
        <thead>
          <tr>
            <SortableHeader label={label} direction={direction} onSort={onSort} className={className} />
          </tr>
        </thead>
      </table>,
    ),
  );
  return root;
}

function getTh(): HTMLTableCellElement {
  const th = container.querySelector('th');
  if (!(th instanceof HTMLTableCellElement)) throw new Error('th não encontrado');
  return th;
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

describe('SortableHeader', () => {
  it('renderiza label sem direção com ícone neutro', () => {
    renderSortableHeader('Vencimento', null, vi.fn());

    const th = getTh();
    expect(th.getAttribute('aria-sort')).toBe('none');
    expect(th.querySelector('button')?.textContent).toBe('Vencimento');
    expect(th.querySelectorAll('svg')).toHaveLength(1);
    expect(th.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('comunica ordenação ascendente', () => {
    renderSortableHeader('Vencimento', 'asc', vi.fn());

    const th = getTh();
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    expect(th.querySelectorAll('svg')).toHaveLength(1);
  });

  it('comunica ordenação descendente', () => {
    renderSortableHeader('Vencimento', 'desc', vi.fn());

    const th = getTh();
    expect(th.getAttribute('aria-sort')).toBe('descending');
    expect(th.querySelectorAll('svg')).toHaveLength(1);
  });

  it('chama onSort ao clicar no botão', () => {
    const onSort = vi.fn();
    renderSortableHeader('Vencimento', null, onSort);

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    act(() => { button!.click(); });

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('aplica className ao th', () => {
    renderSortableHeader('Vencimento', null, vi.fn(), 'px-3 py-3');

    expect(getTh().className).toBe('px-3 py-3');
  });
});
