import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import OperationalPanel from './OperationalPanel';
import type { VehicleRow, DashboardFilters } from './OperationalPanel';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';

vi.mock('./VehicleTypeBarChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'vehicle-type-chart' }),
}));

vi.mock('./MaintenanceTypeDonutChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'maintenance-type-chart' }),
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
