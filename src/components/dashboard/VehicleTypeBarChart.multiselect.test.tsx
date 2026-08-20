import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import VehicleTypeBarChart from './VehicleTypeBarChart';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [{ contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }

    disconnect() {}
    unobserve() {}
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 800, 256));
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

async function waitForChart() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const sampleData = [
  { name: 'A', value: 10 },
  { name: 'B', value: 5 },
  { name: 'C', value: 3 },
];

describe('VehicleTypeBarChart — single-select retrocompatibility', () => {
  it('renders footer "Clique em uma barra para filtrar" in single mode', () => {
    renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={sampleData}
        activeFilter={null}
        onFilterChange={() => {}}
      />,
    );

    expect(container.textContent).toContain('Clique em uma barra para filtrar');
  });

  it('renders "Filtro ativo" header when activeFilter is set', () => {
    renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={sampleData}
        activeFilter="A"
        onFilterChange={() => {}}
      />,
    );

    expect(container.textContent).toContain('Filtro ativo');
    expect(container.textContent).toContain('A');
  });
});

describe('VehicleTypeBarChart — multi-select mode', () => {
  it('renders chips for selected values', () => {
    renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={sampleData}
        selectedValues={['A']}
        onSelect={() => {}}
        onClearAll={() => {}}
        multiSelectHint
      />,
    );

    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('limpar');
  });

  it('renders multi-select hint footer', () => {
    renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={sampleData}
        selectedValues={[]}
        onSelect={() => {}}
        multiSelectHint
      />,
    );

    expect(container.textContent).toContain('Ctrl/Cmd ou pressione e segure');
  });
});

describe('VehicleTypeBarChart — sub-rótulos de eixo', () => {
  it('sem subLabelByName o rodapé e o eixo permanecem como no modo padrão', () => {
    renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={[{ name: 'SRJ10', value: 12 }]}
        activeFilter={null}
        onFilterChange={() => {}}
      />,
    );

    expect(container.textContent).not.toContain('12%');
    expect(container.textContent).toContain('Clique em uma barra para filtrar');
  });

  it('com subLabelByName o percentual aparece junto ao nome do grupo', async () => {
    renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={[{ name: 'SRJ10', value: 12 }]}
        subLabelByName={{ SRJ10: '75%' }}
      />,
    );
    await waitForChart();

    expect(container.textContent).toContain('SRJ10');
    expect(container.textContent).toContain('75%');
  });

  it('grupo ausente do mapa não quebra a renderização', async () => {
    expect(() => renderWithAct(
      <VehicleTypeBarChart
        title="Test"
        data={[
          { name: 'SRJ10', value: 12 },
          { name: 'SP01', value: 5 },
        ]}
        subLabelByName={{ SP01: '60%' }}
      />,
    )).not.toThrow();
    await waitForChart();

    expect(container.textContent).toContain('60%');
  });
});
