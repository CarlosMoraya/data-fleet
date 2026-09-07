import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import MeliUtilizationTable from './MeliUtilizationTable';

import type { MeliUtilizationRow } from '../../types/meliUtilization';

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

function row(overrides: Partial<MeliUtilizationRow> = {}): MeliUtilizationRow {
  return {
    key: 'vehicle-1:route-123',
    vehicleId: 'vehicle-1',
    licensePlate: 'ABC1D23',
    vehicleDescription: 'Mercedes-Benz Sprinter',
    utilized: true,
    routeDate: '2026-09-06',
    routeId: 'route-123',
    driverName: 'Maria Souza',
    fleetDriverName: 'Maria Souza',
    driverDivergent: false,
    unitCode: 'SRJ1',
    fleetUnitCode: 'SRJ1',
    unitDivergent: false,
    unavailableOnDate: false,
    statusDivergent: false,
    cycle: 'AM',
    odometerDistanceKm: 42,
    ...overrides,
  };
}

function render(rows: MeliUtilizationRow[], loading = false) {
  root = createRoot(container);
  act(() => root.render(<MeliUtilizationTable rows={rows} loading={loading} />));
}

describe('MeliUtilizationTable', () => {
  it('renderiza os oito cabeçalhos na ordem especificada', () => {
    render([row()]);

    expect([...container.querySelectorAll('thead th')].map((header) => header.textContent)).toEqual([
      'Placa',
      'Motorista',
      'Id da Rota',
      'Data da Rota',
      'Unidade Operacional',
      'Ciclo',
      'KM rodado',
      'Status',
    ]);
  });

  it('mostra id, data e selo na linha utilizada', () => {
    render([row()]);

    expect(container.textContent).toContain('route-123');
    expect(container.textContent).toContain('06/09/2026');
    expect(container.textContent).toContain('Utilizado');
  });

  it('mostra Não utilizado e travessões na linha sem rota', () => {
    render([
      row({
        key: 'vehicle-1:2026-09-06:idle',
        utilized: false,
        routeId: null,
        driverName: null,
        cycle: null,
        odometerDistanceKm: null,
      }),
    ]);

    expect(container.textContent).toContain('Não utilizado');
    expect(container.textContent).toContain('—');
  });

  it('mostra o motorista cadastrado apenas quando há divergência', () => {
    render([row({ driverName: 'Outra Pessoa', driverDivergent: true })]);

    expect(container.textContent).toContain('Cadastro: Maria Souza');
    expect(container.querySelector('[title*="Motorista da rota diverge"]')).not.toBeNull();
  });

  it('não mostra Cadastro quando não existe divergência', () => {
    render([row()]);

    expect(container.textContent).not.toContain('Cadastro:');
  });

  it('mostra a frase de divergência de status com descrição acessível', () => {
    render([row({ unavailableOnDate: true, statusDivergent: true })]);

    expect(container.textContent).toContain('Rota registrada com veículo indisponível');
    expect(container.querySelector('[title*="rota registrada"]')).not.toBeNull();
  });

  it('mostra o estado vazio', () => {
    render([]);

    expect(container.textContent).toContain(
      'Nenhum veículo MELI dedicado encontrado no período selecionado.',
    );
  });

  it('mostra carregamento sem renderizar o estado vazio', () => {
    render([], true);

    expect(container.textContent).toContain('Carregando utilização MELI…');
    expect(container.textContent).not.toContain('Nenhum veículo MELI dedicado');
  });
});
