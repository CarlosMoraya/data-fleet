import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import VehicleTypeBarChart from './VehicleTypeBarChart';

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

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
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
