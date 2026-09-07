import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import MeliUtilizationKpiCards from './MeliUtilizationKpiCards';

import type { MeliUtilizationKpis } from '../../types/meliUtilization';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
});

function render(kpis: MeliUtilizationKpis, loading = false) {
  root = createRoot(container);
  act(() => root.render(<MeliUtilizationKpiCards kpis={kpis} loading={loading} />));
}

const kpis: MeliUtilizationKpis = {
  totalVehicles: 10,
  usedVehicles: 4,
  unusedVehicles: 6,
  utilizationRate: 40,
};

describe('MeliUtilizationKpiCards', () => {
  it('renderiza os quatro rótulos', () => {
    render(kpis);

    for (const label of [
      'Total de veículos (MELI + Dedicado)',
      'Veículos Utilizados',
      'Não Utilizados',
      '% Utilização',
    ]) {
      expect(container.textContent).toContain(label);
    }
  });

  it('formata a taxa com uma casa decimal', () => {
    render(kpis);

    expect(container.textContent).toContain('40,0%');
  });

  it('mostra esqueletos durante o carregamento', () => {
    render(kpis, true);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
    expect(container.textContent).not.toContain('40,0%');
  });
});
