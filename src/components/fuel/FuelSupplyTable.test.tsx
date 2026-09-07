import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import FuelSupplyTable from './FuelSupplyTable';

import type { FuelSupply } from '../../types/fuelSupply';

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

function render(supplies: FuelSupply[], isLoading = false) {
  root = createRoot(container);
  act(() => {
    root.render(<FuelSupplyTable supplies={supplies} isLoading={isLoading} />);
  });
}

function supply(overrides: Partial<FuelSupply> = {}): FuelSupply {
  return {
    id: 'fs-1',
    clientId: 'c1',
    vehicleId: 'v1',
    driverId: null,
    plate: 'ABC1D23',
    driverName: 'JOSE DA SILVA',
    vehicleModel: 'ONIX',
    fuelType: 'GASOLINA COMUM',
    amountLiters: 8.94,
    unitValue: 5.59,
    totalValue: 50,
    odometer: 28620,
    previousOdometer: 28000,
    kmTraveled: 620,
    transactionDate: '2026-09-01T12:00:00.000Z',
    transactionStatus: 'APROVADA',
    supplyLocation: 'AUTOPOSTO TESTE LTDA',
    network: 'POSTOS VELOE',
    costCenter: 'OO1',
    baseName: 'VELOE MARKETING',
    cardLast4: '3456',
    shipperId: 's1',
    shipperName: 'Mercado Livre',
    operationalUnitId: 'u1',
    operationalUnitName: 'Base Cajamar',
    ...overrides,
  };
}

describe('FuelSupplyTable', () => {
  it('renderiza os 9 cabeçalhos na ordem especificada', () => {
    render([supply()]);

    const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(headers).toEqual([
      'Data',
      'Placa',
      'Motorista',
      'Km do veículo',
      'Litros',
      'Valor',
      'Embarcador',
      'Unidade',
      'Posto',
    ]);
  });

  it('renderiza a linha com os dados formatados', () => {
    render([supply()]);

    expect(container.textContent).toContain('ABC1D23');
    expect(container.textContent).toContain('JOSE DA SILVA');
    expect(container.textContent).toContain('28.620 km');
    expect(container.textContent).toContain('AUTOPOSTO TESTE LTDA');
  });

  it('exibe "Não identificado" quando o veículo não foi casado', () => {
    render([
      supply({
        id: 'sem-veiculo',
        vehicleId: null,
        shipperName: null,
        operationalUnitName: null,
      }),
    ]);

    expect(container.textContent).toContain('Não identificado');
  });

  it('exibe o estado vazio quando não há abastecimentos', () => {
    render([]);

    expect(container.textContent).toContain('Nenhum abastecimento no período selecionado.');
  });

  it('exibe o estado de carregamento', () => {
    render([], true);

    expect(container.textContent).toContain('Carregando abastecimentos…');
    expect(container.textContent).not.toContain('Nenhum abastecimento no período selecionado.');
  });
});
