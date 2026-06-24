import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import MaintenanceTypeDonutChart, { deriveDonutState } from './MaintenanceTypeDonutChart';

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
  return root;
}

describe('deriveDonutState', () => {
  it('returns empty state for empty array', () => {
    expect(deriveDonutState([])).toEqual({
      total: 0,
      isEmpty: true,
      isFilterable: false,
    });
  });

  it('returns non-filterable state for single category', () => {
    expect(
      deriveDonutState([{ name: 'Corretiva', value: 12 }])
    ).toEqual({
      total: 12,
      isEmpty: false,
      isFilterable: false,
    });
  });

  it('returns total and filterable state for multiple categories', () => {
    expect(
      deriveDonutState([
        { name: 'Corretiva', value: 12 },
        { name: 'Preventiva', value: 8 },
      ])
    ).toEqual({
      total: 20,
      isEmpty: false,
      isFilterable: true,
    });
  });
});

describe('MaintenanceTypeDonutChart', () => {
  it('renders friendly empty state message', () => {
    renderWithAct(
      <MaintenanceTypeDonutChart
        data={[]}
        activeFilter={null}
        onFilterChange={() => {}}
        title="Manutenções por Tipo"
      />
    );

    expect(container.textContent).toContain('Sem dados no período.');
    expect(container.textContent).not.toContain('Clique em uma fatia para filtrar');
  });

  it('renders filter caption only with multiple categories', () => {
    renderWithAct(
      <MaintenanceTypeDonutChart
        data={[
          { name: 'Corretiva', value: 12 },
          { name: 'Preventiva', value: 8 },
        ]}
        activeFilter={null}
        onFilterChange={() => {}}
        title="Manutenções por Tipo"
      />
    );

    expect(container.textContent).toContain('Clique em uma fatia para filtrar');
  });

  it('does not render filter caption with a single category', () => {
    renderWithAct(
      <MaintenanceTypeDonutChart
        data={[{ name: 'Corretiva', value: 12 }]}
        activeFilter={null}
        onFilterChange={() => {}}
        title="Manutenções por Tipo"
      />
    );

    expect(container.textContent).not.toContain('Clique em uma fatia para filtrar');
  });
});
