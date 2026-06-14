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
  const allP = container.querySelectorAll('p');
  for (const p of allP) {
    if (p.textContent === 'CRLVs Vencidos') {
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
});
