import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import FuelSupplyKpiCards from './FuelSupplyKpiCards';

import type { FuelSupplyKpis } from '../../lib/fuelSupplyKpi';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
});

function render(kpis: FuelSupplyKpis) {
  root = createRoot(container);
  act(() => {
    root.render(<FuelSupplyKpiCards kpis={kpis} />);
  });
}

const baseKpis: FuelSupplyKpis = {
  totalValue: 1234.56,
  totalLiters: 220.5,
  averagePricePerLiter: 5.6,
  averageKmPerLiter: 3.25,
  supplyCount: 12,
};

describe('FuelSupplyKpiCards', () => {
  it('renderiza os 5 rótulos', () => {
    render(baseKpis);

    for (const label of [
      'Valor total',
      'Litros totais',
      'Preço médio/litro',
      'Consumo médio',
      'Abastecimentos',
    ]) {
      expect(container.textContent).toContain(label);
    }
  });

  it('formata o valor monetário em pt-BR', () => {
    render(baseKpis);

    expect(container.textContent).toContain('1.234,56');
    expect(container.textContent).toContain('3,25 km/L');
  });

  it('exibe travessão quando o consumo médio é nulo', () => {
    render({ ...baseKpis, averageKmPerLiter: null });

    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('km/L');
  });
});
