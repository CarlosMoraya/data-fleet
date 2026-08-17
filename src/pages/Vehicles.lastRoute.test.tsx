import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fromMock,
  getActiveLoansForVehiclesMock,
  getVehicleLastKmMapMock,
  getVehicleLastRouteMapMock,
  rpcMock,
  useAuthMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getActiveLoansForVehiclesMock: vi.fn(),
  getVehicleLastKmMapMock: vi.fn(),
  getVehicleLastRouteMapMock: vi.fn(),
  rpcMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: (): unknown => useAuthMock() }));

vi.mock('../services/vehicleLastRouteService', () => ({
  buildLastRouteText: (info: { lastRouteDate: string; routeId: string } | null | undefined) =>
    info == null ? null : `Últ. rota 15/08/2026 · #${info.routeId}`,
  getVehicleLastRouteMap: getVehicleLastRouteMapMock,
  normalizeFleetPlate: (value: string | null | undefined) => (value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(-7),
}));

vi.mock('../services/vehicleOdometerService', () => ({
  buildLastKmDisplayParts: () => ({
    prefix: 'Último Km:',
    valueText: null,
    suffix: null,
    fullText: 'Último Km: sem leitura',
  }),
  getVehicleLastKmMap: getVehicleLastKmMapMock,
}));

vi.mock('../services/vehicleLoanService', () => ({
  completeVehicleLoan: vi.fn(),
  getActiveVehicleLoan: vi.fn(),
  getActiveLoansForVehicles: getActiveLoansForVehiclesMock,
}));

import Vehicles from './Vehicles';

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

const DELUNA_CLIENT_ID = 'client-deluna';

let container: Container;
let queryClient: QueryClient;

function vehicleRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'v-route',
    client_id: DELUNA_CLIENT_ID,
    active: true,
    type: 'Truck',
    license_plate: 'TEV8C85',
    renavam: '123',
    chassi: 'CHASSI123',
    detran_uf: 'SP',
    brand: 'Volvo',
    model: 'FH',
    year: 2024,
    color: 'Branco',
    acquisition: 'Owned',
    energy_source: 'Combustão',
    fipe_price: 1000,
    tracker: '',
    antt: '',
    owner: '',
    autonomy: 0,
    cooling_equipment: false,
    spare_key: false,
    vehicle_manual: false,
    warranty: false,
    has_insurance: false,
    has_maintenance_contract: false,
    drivers: null,
    shippers: null,
    operational_units: null,
    ...overrides,
  };
}

function chain(response: { data?: unknown; error?: unknown }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    not: vi.fn(() => self),
    order: vi.fn(() => Promise.resolve({
      data: response.data ?? [],
      error: response.error ?? null,
    })),
    maybeSingle: vi.fn(() => Promise.resolve({
      data: response.data ?? null,
      error: response.error ?? null,
    })),
    then: (resolve: (value: unknown) => void) => resolve({
      data: response.data ?? [],
      error: response.error ?? null,
    }),
  };
  return self;
}

beforeEach(() => {
  vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', DELUNA_CLIENT_ID);
  window.localStorage.clear();
  window.sessionStorage.clear();

  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  rpcMock.mockReset();
  getActiveLoansForVehiclesMock.mockReset();
  getVehicleLastKmMapMock.mockReset();
  getVehicleLastRouteMapMock.mockReset();
  useAuthMock.mockReset();

  const vehicles = [
    vehicleRow(),
    vehicleRow({ id: 'v-no-route', license_plate: 'ABC1D23', chassi: 'CHASSI456' }),
  ];
  fromMock.mockImplementation((table: string) => (
    table === 'vehicles' ? chain({ data: vehicles }) : chain({ data: [] })
  ));
  rpcMock.mockResolvedValue({ data: [], error: null });
  getActiveLoansForVehiclesMock.mockResolvedValue(new Map());
  getVehicleLastKmMapMock.mockResolvedValue(new Map());
  getVehicleLastRouteMapMock.mockResolvedValue(new Map([
    ['TEV8C85', { lastRouteDate: '2026-08-15', routeId: '425129405' }],
  ]));
  useAuthMock.mockReturnValue({
    user: { id: 'u1', role: 'Fleet Assistant', clientId: DELUNA_CLIENT_ID },
    currentClient: { id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' },
    clients: [{ id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' }],
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.unstubAllEnvs();
});

function renderPage() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Vehicles />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

async function settleQueries() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

function rowForPlate(plate: string): HTMLTableRowElement | undefined {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')]
    .find((row) => row.textContent?.includes(plate));
}

describe('Vehicles — última rota', () => {
  it('exibe a última rota e o filtro para o cliente configurado', async () => {
    renderPage();
    await settleQueries();

    expect(rowForPlate('TEV8C85')?.textContent)
      .toContain('Últ. rota 15/08/2026 · #425129405');
    expect(container.querySelector('select[aria-label="Última rota"]')).not.toBeNull();
  });

  it('não exibe informação de rota nem placeholder para veículo não localizado', async () => {
    renderPage();
    await settleQueries();

    expect(rowForPlate('ABC1D23')?.textContent).not.toContain('Últ. rota');
  });

  it('não chama nem renderiza o recurso para outro cliente', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'u2', role: 'Fleet Assistant', clientId: 'client-other' },
      currentClient: { id: 'client-other', name: 'Outro cliente' },
      clients: [{ id: 'client-other', name: 'Outro cliente' }],
    });

    renderPage();
    await settleQueries();

    expect(getVehicleLastRouteMapMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Últ. rota');
    expect(container.querySelector('select[aria-label="Última rota"]')).toBeNull();
  });
});
