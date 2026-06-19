import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import OperationalPanel from './OperationalPanel';
import type { VehicleRow, DashboardFilters } from './OperationalPanel';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';

vi.mock('./VehicleTypeBarChart', () => ({
  default: ({ title }: { title?: string }) =>
    React.createElement('div', { 'data-testid': 'vehicle-type-chart', 'data-title': title }),
}));

vi.mock('./MaintenanceTypeDonutChart', () => ({
  default: ({ title }: { title?: string }) =>
    React.createElement('div', { 'data-testid': 'maintenance-type-chart', 'data-title': title }),
}));

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as any).__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as any).__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

async function flushLazy() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

const noOrders: MaintenanceOrderDashboard[] = [];

function findCrlvCardValue(): string | null {
  return findCardValueByLabel('CRLVs Vencidos');
}

function findCardValueByLabel(label: string): string | null {
  const allP = container.querySelectorAll('p');
  for (const p of allP) {
    if (p.textContent === label) {
      const valueEl = p.nextElementSibling;
      return valueEl?.textContent ?? null;
    }
  }
  return null;
}

const baseProps = {
  maintenanceOrders: noOrders,
  activeMaintenanceOrders: noOrders,
  overdueChecklistVehicleIds: new Set<string>(),
  expiredCnhCount: 0,
  overdueOrdersCount: 0,
  expiringSoonDocsCount: 0,
  actionItems: [],
  onFiltersChange: (_f: DashboardFilters) => {},
};

describe('OperationalPanel — CRLVs Vencidos under vehicle type filter', () => {
  it('vehicle with crlv_year < current year but crlv_expiration_date in future is NOT counted as expired', () => {
    const vehicles: VehicleRow[] = [
      {
        id: 'v1',
        type: 'Truck',
        crlv_year: '2025',
        crlv_expiration_date: '2027-01-15',
        driver_id: null,
      },
    ];

    const filters: DashboardFilters = { vehicleType: 'Truck', maintenanceType: null };

    renderWithAct(
      <OperationalPanel
        vehicles={vehicles}
        filters={filters}
        expiredCrlvCount={99}
        {...baseProps}
      />
    );

    expect(findCrlvCardValue()).toBe('0');
  });

  it('vehicle with crlv_expiration_date in the past IS counted as expired', () => {
    const vehicles: VehicleRow[] = [
      {
        id: 'v1',
        type: 'Truck',
        crlv_year: '2026',
        crlv_expiration_date: '2025-12-31',
        driver_id: null,
      },
    ];

    const filters: DashboardFilters = { vehicleType: 'Truck', maintenanceType: null };

    renderWithAct(
      <OperationalPanel
        vehicles={vehicles}
        filters={filters}
        expiredCrlvCount={0}
        {...baseProps}
      />
    );

    expect(findCrlvCardValue()).toBe('1');
  });

  it('vehicle with crlv_expiration_date=null and crlv_year < current year IS counted as expired (fallback)', () => {
    const vehicles: VehicleRow[] = [
      {
        id: 'v1',
        type: 'Truck',
        crlv_year: '2024',
        crlv_expiration_date: null,
        driver_id: null,
      },
    ];

    const filters: DashboardFilters = { vehicleType: 'Truck', maintenanceType: null };

    renderWithAct(
      <OperationalPanel
        vehicles={vehicles}
        filters={filters}
        expiredCrlvCount={0}
        {...baseProps}
      />
    );

    expect(findCrlvCardValue()).toBe('1');
  });

  it('without vehicle type filter, expiredCrlvCount prop is used directly', () => {
    const vehicles: VehicleRow[] = [
      {
        id: 'v1',
        type: 'Truck',
        crlv_year: '2024',
        crlv_expiration_date: null,
        driver_id: null,
      },
    ];

    const filters: DashboardFilters = { vehicleType: null, maintenanceType: null };

    renderWithAct(
      <OperationalPanel
        vehicles={vehicles}
        filters={filters}
        expiredCrlvCount={3}
        {...baseProps}
      />
    );

    expect(findCrlvCardValue()).toBe('3');
  });

  it('renders OS em Atraso value from overdueOrdersCount prop', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        overdueOrdersCount={4}
      />
    );

    expect(findCardValueByLabel('OS em Atraso')).toBe('4');
  });

  it('renders Documentos a Vencer value from expiringSoonDocsCount prop', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        expiringSoonDocsCount={7}
      />
    );

    expect(findCardValueByLabel('Documentos a Vencer (30d)')).toBe('7');
  });

  it('exception cards render before neutral cards', () => {
    renderWithAct(
      <OperationalPanel
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        {...baseProps}
      />
    );

    const labels = Array.from(container.querySelectorAll('p'))
      .map((node) => node.textContent)
      .filter((text): text is string => text != null);

    expect(labels.indexOf('OS em Atraso')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Total de Veículos')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('OS em Atraso')).toBeLessThan(labels.indexOf('Total de Veículos'));
  });

  it('clicking an exception card calls onActionClick with its category', () => {
    const onActionClick = vi.fn();

    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        onActionClick={onActionClick}
      />
    );

    const label = Array.from(container.querySelectorAll('p')).find(
      (node) => node.textContent === 'OS em Atraso'
    );

    expect(label).toBeTruthy();

    const button = label?.closest('button');
    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onActionClick).toHaveBeenCalledWith('os_overdue');
  });

  it('when onActionClick is omitted, exception card does not render as button', () => {
    renderWithAct(
      <OperationalPanel
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        {...baseProps}
      />
    );

    const label = Array.from(container.querySelectorAll('p')).find(
      (node) => node.textContent === 'OS em Atraso'
    );

    expect(label).toBeTruthy();
    expect(label?.closest('button')).toBeNull();
    expect(label?.parentElement?.parentElement?.tagName).not.toBe('BUTTON');
  });
});

describe('OperationalPanel — legibilidade dos títulos de KPI', () => {
  it('renders the shortened title "Tempo médio de OS"', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
      />
    );

    expect(findCardValueByLabel('Tempo médio de OS')).toBe('—');
    expect(container.textContent).toContain('OS concluídas no mês');
  });

  it('renders the shortened title "Idade média de OS abertas"', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
      />
    );

    expect(findCardValueByLabel('Idade média de OS abertas')).toBe('—');
  });

  it('applies line-clamp-2 to KPI labels instead of truncate', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
      />
    );

    const label = Array.from(container.querySelectorAll('p')).find(
      (node) => node.textContent === 'Tempo médio de OS'
    );

    expect(label).toBeTruthy();
    expect(label?.classList.contains('line-clamp-2')).toBe(true);
    expect(label?.classList.contains('truncate')).toBe(false);
  });
});

describe('OperationalPanel — ordem de prioridade dos gráficos', () => {
  it('renders charts in operational priority order', async () => {
    const vehicles: VehicleRow[] = [
      {
        id: 'v1',
        type: 'Truck',
        crlv_year: '2026',
        crlv_expiration_date: null,
        driver_id: null,
        shipper_name: 'Embarcador A',
        operational_unit_name: 'Unidade 1',
      },
    ];

    const activeMaintenanceOrders: MaintenanceOrderDashboard[] = [
      {
        id: 'mo-1',
        vehicle_id: 'v1',
        type: 'Corretiva',
        status: 'Aguardando aprovação',
        approved_cost: null,
        current_km: null,
        vehicle_type: 'Truck',
        expected_exit_date: null,
        entry_date: '2026-06-10',
        actual_exit_date: null,
      },
    ];

    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={vehicles}
        maintenanceOrders={activeMaintenanceOrders}
        activeMaintenanceOrders={activeMaintenanceOrders}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
      />
    );

    await flushLazy();

    const chartNodes = Array.from(
      container.querySelectorAll('[data-testid="vehicle-type-chart"], [data-testid="maintenance-type-chart"]')
    );
    const titles = chartNodes.map((n) => n.getAttribute('data-title'));

    expect(titles).toEqual([
      'Fila de Manutenção por Status',
      'Frota por Unidade Operacional',
      'Frota por Embarcador',
      'Frota por Tipo de Veículo',
      'Manutenções por Tipo',
    ]);
  });
});

describe('OperationalPanel — fila operacional', () => {
  it('renders action queue item labels when actionItems are provided', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        actionItems={[
          {
            category: 'gr_vehicle_expiring',
            label: 'Veículos com GR a vencer (30d)',
            count: 1,
            severity: 'medium',
            details: ['ABC1D23'],
          },
        ]}
      />
    );

    expect(container.textContent).toContain('Veículos com GR a vencer (30d)');
  });

  it('clicking an action queue item calls onActionClick with its category', () => {
    const onActionClick = vi.fn();

    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        onActionClick={onActionClick}
        actionItems={[
          {
            category: 'gr_vehicle_expiring',
            label: 'Veículos com GR a vencer (30d)',
            count: 1,
            severity: 'medium',
            details: ['ABC1D23'],
          },
        ]}
      />
    );

    const button = Array.from(container.querySelectorAll('button')).find(
      (node) => node.textContent?.includes('Veículos com GR a vencer (30d)')
    );

    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onActionClick).toHaveBeenCalledWith('gr_vehicle_expiring');
  });

  it('renders the empty action queue state when actionItems is empty', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        vehicles={[]}
        filters={{ vehicleType: null, maintenanceType: null }}
        expiredCrlvCount={0}
        actionItems={[]}
      />
    );

    expect(container.textContent).toContain('Nenhuma ação crítica pendente. Frota em dia.');
  });
});
