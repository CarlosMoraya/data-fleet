import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import OverviewPanel from './OverviewPanel';

import type { VehicleRow } from './OperationalPanel';

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

const baseProps = {
  vehicles: [] as VehicleRow[],
  activeMaintenanceOrders: [] as { vehicle_id: string; status: string }[],
  currentMonthOrders: [] as { vehicle_id: string; approved_cost: number | null }[],
  overdueChecklistVehicleIds: new Set<string>(),
  isLoading: false,
};

describe('OverviewPanel — regressão de conteúdo removido', () => {
  it('não exibe Documentos Vencidos nem Documentos a Vencer (30d)', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).not.toContain('Documentos a Vencer (30d)');
    expect(text).not.toContain('Documentos Vencidos');
  });

  it('não exibe Fila de Ação', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).not.toContain('Fila de Ação');
  });

  it('não exibe cards removidos e itens fora de escopo', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).not.toContain('OS Abertas');
    expect(text).not.toContain('OS em Atraso');
    expect(text).not.toContain('OS Aguardando Aprovação');
    expect(text).not.toContain('Veículos em Manutenção');
    expect(text).not.toContain('Veículos sem Motorista');
  });

  it('exibe os 8 rótulos executivos e o cabeçalho Mapa da Frota', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).toContain('Total de Veículos');
    expect(text).toContain('Veículos Disponíveis');
    expect(text).toContain('Veículos Indisponíveis');
    expect(text).toContain('Disponibilidade da Frota');
    expect(text).toContain('Custo do Mês Atual');
    expect(text).toContain('Conformidade de Checklist');
    expect(text).toContain('Cobertura de Rastreador');
    expect(text).toContain('Cobertura de Seguro');
    expect(text).toContain('Mapa da Frota');
  });

  it('renders current-state copy and current month cost label', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).toContain('Situação atual da frota');
    expect(text).toContain('Custo do Mês Atual');
    expect(text).not.toContain('Custo Total do Período');
  });
});

describe('OverviewPanel — derives cards from raw data', () => {
  it('shows correct total from vehicles array', () => {
    const vehicles: VehicleRow[] = [
      {
        id: '1',
        type: 'Cavalo',
        crlv_year: null,
        crlv_expiration_date: null,
        driver_id: null,
        category: 'Pesado',
        model: 'Volvo FH',
        acquisition: 'Owned',
        shipper_name: 'ACME',
        operational_unit_name: 'SP',
        license_plate: 'AAA-1234',
        brand: 'Volvo',
        has_insurance: true,
        tracker: 'rastreador1',
      },
      {
        id: '2',
        type: 'Truck',
        crlv_year: null,
        crlv_expiration_date: null,
        driver_id: null,
        category: 'Leve',
        model: 'Iveco Daily',
        acquisition: 'Rented',
        shipper_name: 'Beta',
        operational_unit_name: 'RJ',
        license_plate: 'BBB-5678',
        brand: 'Iveco',
        has_insurance: false,
        tracker: null,
      },
    ];

    renderWithAct(
      <OverviewPanel
        vehicles={vehicles}
        activeMaintenanceOrders={[{ vehicle_id: '1', status: 'Serviço em execução' }]}
        currentMonthOrders={[{ vehicle_id: '1', approved_cost: 500 }]}
        overdueChecklistVehicleIds={new Set(['2'])}
        isLoading={false}
      />,
    );

    const text = container.textContent ?? '';
    expect(text).toContain('2');
  });
});

describe('OverviewPanel — rosca de disponibilidade e reorganização do Mapa da Frota', () => {
  async function renderWithActAsync(ui: React.ReactElement) {
    const root = createRoot(container);
    container.__reactRoot = root;
    await act(async () => {
      root.render(ui);
    });
    return root;
  }

  const vehicles: VehicleRow[] = [
    {
      id: '1',
      type: 'Cavalo',
      crlv_year: null,
      crlv_expiration_date: null,
      driver_id: null,
      category: 'Pesado',
      model: 'Volvo FH',
      acquisition: 'Owned',
      shipper_name: 'ACME',
      operational_unit_name: 'SP',
      license_plate: 'AAA-1234',
      brand: 'Volvo',
      has_insurance: true,
      tracker: 'rastreador1',
    },
    {
      id: '2',
      type: 'Truck',
      crlv_year: null,
      crlv_expiration_date: null,
      driver_id: null,
      category: 'Leve',
      model: 'Iveco Daily',
      acquisition: 'Rented',
      shipper_name: 'Beta',
      operational_unit_name: 'RJ',
      license_plate: 'BBB-5678',
      brand: 'Iveco',
      has_insurance: false,
      tracker: null,
    },
  ];

  it('renderiza o FleetAvailabilityDonutChart', async () => {
    await renderWithActAsync(<OverviewPanel {...baseProps} vehicles={vehicles} />);

    const text = container.textContent ?? '';
    expect(text).toContain('Disponibilidade da Frota');
  });

  it('"Frota por Unidade Operacional" aparece exatamente 1 vez', async () => {
    await renderWithActAsync(<OverviewPanel {...baseProps} vehicles={vehicles} />);

    const matches = (container.textContent ?? '').match(/Frota por Unidade Operacional/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('"Frota por Embarcador" aparece exatamente 1 vez', async () => {
    await renderWithActAsync(<OverviewPanel {...baseProps} vehicles={vehicles} />);

    const matches = (container.textContent ?? '').match(/Frota por Embarcador/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('clicar em "Indisponíveis" filtra os cards e reflete na barra de filtros ativos', async () => {
    await renderWithActAsync(
      <OverviewPanel
        {...baseProps}
        vehicles={vehicles}
        activeMaintenanceOrders={[{ vehicle_id: '1', status: 'Serviço em execução' }]}
      />,
    );

    const indisponiveisButton = Array.from(container.querySelectorAll('button')).find((el) =>
      (el.textContent ?? '').includes('Indisponíveis — 1'),
    );
    expect(indisponiveisButton).toBeTruthy();

    await act(async () => {
      indisponiveisButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Disponibilidade: Indisponíveis');

    const limparTudo = Array.from(container.querySelectorAll('button')).find(
      (el) => el.textContent === 'Limpar tudo',
    );
    expect(limparTudo).toBeTruthy();

    await act(async () => {
      limparTudo!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent ?? '').not.toContain('Disponibilidade: Indisponíveis');
  });
});
