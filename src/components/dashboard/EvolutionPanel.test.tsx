import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';
import type { HorizonOption } from '../../lib/dashboardKpi';

vi.mock('./CostTrendChart', () => ({
  default: ({ data, title }: { data: { name: string; value: number }[]; title: string }) => (
    <div data-testid="cost-trend-chart">
      <h3>{title}</h3>
      {data.length === 0 || data.every((d) => d.value === 0) ? (
        <p>Sem dados de custo no período.</p>
      ) : (
        <p>Chart data: {data.length} points</p>
      )}
    </div>
  ),
}));

vi.mock('./MonthlyMultiBarChart', () => ({
  default: ({ data, title, series }: { data: Array<Record<string, string | number>>; title: string; series?: { key: string }[] }) => {
    const isEmpty = data.length === 0 || (series && data.every((d) => series.every((s) => (d[s.key] as number) === 0)));
    return (
      <div data-testid="monthly-multi-bar-chart">
        <h3>{title}</h3>
        {isEmpty ? (
          <p>Sem dados no período.</p>
        ) : (
          <p>Chart data: {data.length} months</p>
        )}
      </div>
    );
  },
}));

const EvolutionPanel = (await import('./EvolutionPanel')).default;

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

const sampleOrders: MaintenanceOrderDashboard[] = [
  {
    id: '1',
    vehicle_id: 'v1',
    type: 'Corretiva',
    status: 'Concluído',
    approved_cost: 500,
    current_km: null,
    vehicle_type: 'Truck',
    expected_exit_date: null,
    entry_date: '2026-04-01',
    actual_exit_date: '2026-04-05',
  },
  {
    id: '2',
    vehicle_id: 'v2',
    type: 'Preventiva',
    status: 'Concluído',
    approved_cost: 300,
    current_km: null,
    vehicle_type: 'Van',
    expected_exit_date: null,
    entry_date: '2026-05-10',
    actual_exit_date: '2026-05-15',
  },
];

describe('EvolutionPanel', () => {
  it('renders HorizonSelector with all four labels', () => {
    renderWithAct(
      <EvolutionPanel
        orders={sampleOrders}
        horizon="6m"
        onHorizonChange={() => {}}
        dateRange={{ from: '2026-01-01', to: '2026-06-30' }}
      />
    );

    expect(container.textContent).toContain('Últimos 3 meses');
    expect(container.textContent).toContain('Últimos 6 meses');
    expect(container.textContent).toContain('Últimos 12 meses');
    expect(container.textContent).toContain('Ano atual');
  });

  it('renders the four chart titles', () => {
    renderWithAct(
      <EvolutionPanel
        orders={sampleOrders}
        horizon="6m"
        onHorizonChange={() => {}}
        dateRange={{ from: '2026-01-01', to: '2026-06-30' }}
      />
    );

    expect(container.textContent).toContain('Custo Mensal de Manutenção');
    expect(container.textContent).toContain('Tempo Médio de Conclusão de OS por Mês');
    expect(container.textContent).toContain('OS por Mês (Abertas vs Concluídas)');
    expect(container.textContent).toContain('Distribuição Mensal por Tipo de Manutenção');
  });

  it('calls onHorizonChange with "12m" when clicking "Últimos 12 meses"', () => {
    let selected: HorizonOption | null = null;
    renderWithAct(
      <EvolutionPanel
        orders={sampleOrders}
        horizon="6m"
        onHorizonChange={(h) => { selected = h; }}
        dateRange={{ from: '2026-01-01', to: '2026-06-30' }}
      />
    );

    const buttons = container.querySelectorAll<HTMLButtonElement>('button[type="button"]');
    const twelveMonthBtn = Array.from(buttons).find(
      (b) => b.textContent === 'Últimos 12 meses'
    );
    expect(twelveMonthBtn).toBeDefined();
    act(() => {
      twelveMonthBtn!.click();
    });
    expect(selected).toBe('12m');
  });

  it('shows empty-state text when orders is empty', () => {
    renderWithAct(
      <EvolutionPanel
        orders={[]}
        horizon="6m"
        onHorizonChange={() => {}}
        dateRange={{ from: '2026-01-01', to: '2026-06-30' }}
      />
    );

    expect(container.textContent).toContain('Sem dados de custo no período.');
    expect(container.textContent).toContain('Sem dados no período.');
  });
});
