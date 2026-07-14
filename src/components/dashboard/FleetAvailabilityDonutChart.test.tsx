import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  AVAILABILITY_AVAILABLE,
  AVAILABILITY_UNAVAILABLE,
  type AvailabilityValue,
} from '../../lib/overviewFleetFilters';

import FleetAvailabilityDonutChart from './FleetAvailabilityDonutChart';

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

const data: { name: AvailabilityValue; value: number }[] = [
  { name: AVAILABILITY_AVAILABLE, value: 7 },
  { name: AVAILABILITY_UNAVAILABLE, value: 3 },
];

describe('FleetAvailabilityDonutChart', () => {
  it('renderiza título e legenda com contagens e percentuais corretos', () => {
    renderWithAct(
      <FleetAvailabilityDonutChart
        data={data}
        selectedValues={[]}
        onSelect={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Disponibilidade da Frota');
    expect(container.textContent).toContain('Disponíveis — 7 (70%)');
    expect(container.textContent).toContain('Indisponíveis — 3 (30%)');
  });

  it('clicar na legenda "Indisponíveis" dispara onSelect com additive false', () => {
    const onSelect = vi.fn();
    renderWithAct(
      <FleetAvailabilityDonutChart
        data={data}
        selectedValues={[]}
        onSelect={onSelect}
        onClearAll={vi.fn()}
      />,
    );

    const button = Array.from(container.querySelectorAll('button')).find((el) =>
      (el.textContent ?? '').includes('Indisponíveis — 3'),
    );
    expect(button).toBeTruthy();

    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith(AVAILABILITY_UNAVAILABLE, false);
  });

  it('renderiza chip com botão remover quando há seleção ativa', () => {
    renderWithAct(
      <FleetAvailabilityDonutChart
        data={data}
        selectedValues={[AVAILABILITY_UNAVAILABLE]}
        onSelect={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    const removeButton = container.querySelector(`[aria-label="Remover ${AVAILABILITY_UNAVAILABLE}"]`);
    expect(removeButton).toBeTruthy();
  });

  it('exibe empty state quando data soma 0', () => {
    renderWithAct(
      <FleetAvailabilityDonutChart
        data={[
          { name: AVAILABILITY_AVAILABLE, value: 0 },
          { name: AVAILABILITY_UNAVAILABLE, value: 0 },
        ]}
        selectedValues={[]}
        onSelect={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Nenhum veículo na frota.');
  });
});
