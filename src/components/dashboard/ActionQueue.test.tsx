import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import ActionQueue from './ActionQueue';

import type { ActionQueueItemLike } from './ActionQueue';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function render(el: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => { root.render(el); });
  return root;
}

describe('ActionQueue — regressão de chave React duplicada', () => {
  it('exibe apenas um chip por placa quando há duplicatas nos details', () => {
    const items: ActionQueueItemLike[] = [
      {
        category: 'actionPlansOpen',
        label: 'Planos de ação de checklist abertos',
        count: 3,
        severity: 'high',
        details: ['DEV1A23', 'DEV1A23', 'DEV1A23'],
      },
    ];

    render(<ActionQueue items={items} />);

    const chips = container.querySelectorAll('.rounded-full.bg-zinc-100');
    const devChips = Array.from(chips).filter((c) => c.textContent === 'DEV1A23');

    expect(devChips).toHaveLength(1);
  });

  it('preserva a contagem do badge independente da deduplicação dos chips', () => {
    const items: ActionQueueItemLike[] = [
      {
        category: 'actionPlansOpen',
        label: 'Planos de ação de checklist abertos',
        count: 3,
        severity: 'high',
        details: ['DEV1A23', 'DEV1A23', 'DEV1A23'],
      },
    ];

    render(<ActionQueue items={items} />);

    const text = container.textContent ?? '';
    expect(text).toContain('3');
  });

  it('exibe "+N mais" quando há mais de 5 valores únicos', () => {
    const items: ActionQueueItemLike[] = [
      {
        category: 'testCategory',
        label: 'Categoria de teste',
        count: 7,
        severity: 'medium',
        details: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
    ];

    render(<ActionQueue items={items} />);

    const chips = container.querySelectorAll('.rounded-full.bg-zinc-100');
    expect(chips).toHaveLength(5);

    const text = container.textContent ?? '';
    expect(text).toContain('+2 mais');
  });

  it('não exibe "+N mais" quando há mais de 5 valores totais mas menos de 5 únicos', () => {
    const items: ActionQueueItemLike[] = [
      {
        category: 'testCategory',
        label: 'Categoria de teste',
        count: 7,
        severity: 'medium',
        details: ['A', 'A', 'A', 'B', 'B', 'C', 'C'],
      },
    ];

    render(<ActionQueue items={items} />);

    const chips = container.querySelectorAll('.rounded-full.bg-zinc-100');
    expect(chips).toHaveLength(3);

    const text = container.textContent ?? '';
    expect(text).not.toContain('+');
  });
});
