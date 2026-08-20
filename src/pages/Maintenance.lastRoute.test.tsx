import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Maintenance from './Maintenance';

const { fromMock, useAuthMock, getVehicleLastRouteMapMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  useAuthMock: vi.fn(),
  getVehicleLastRouteMapMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

vi.mock('../components/MaintenanceDetailModal', () => ({
  default: () => null,
}));

vi.mock('../components/MaintenanceForm', () => ({
  default: () => null,
}));

vi.mock('../components/WorkshopProfileBanner', () => ({
  default: () => null,
}));

vi.mock('../services/maintenanceService', () => ({
  saveMaintenanceOrder: vi.fn(),
  updateMaintenanceStatus: vi.fn(),
  cancelMaintenanceOrder: vi.fn(),
}));

vi.mock('../services/vehicleLastRouteService', () => ({
  getVehicleLastRouteMap: getVehicleLastRouteMapMock,
  normalizeFleetPlate: (value: string | null | undefined) => (value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(-7),
  buildLastRouteDateText: (info: { lastRouteDate: string; routeId: string } | null | undefined) =>
    info == null ? null : 'Últ. rota 15/08/2026',
}));

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

const DELUNA_CLIENT_ID = 'client-deluna';

let container: Container;
let queryClient: QueryClient;

function maintenanceRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'mo-1',
    os_number: 'OS-001',
    client_id: DELUNA_CLIENT_ID,
    vehicle_id: 'v-1',
    workshop_id: 'ws-1',
    type: 'Corretiva',
    status: 'Aguardando orçamento',
    entry_date: '2026-08-10',
    expected_exit_date: '2026-08-12',
    current_km: 1000,
    vehicles: { license_plate: 'TEV8C85', model: 'FH', shippers: null, operational_units: null },
    workshops: { name: 'Oficina Teste' },
    profiles: { name: 'João' },
    clients: { name: 'Deluna Transportes' },
    ...overrides,
  };
}

function chain(resp: { data?: unknown; error?: unknown }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    order: vi.fn(() => self),
    then: (resolve: (v: unknown) => void) => resolve({
      data: resp.data ?? [],
      error: resp.error ?? null,
    }),
  };
  return self;
}

function authFor(currentClientId: string) {
  return {
    user: { id: 'u1', role: 'Fleet Assistant', clientId: currentClientId },
    currentClient: currentClientId ? { id: currentClientId, name: 'Cliente Teste' } : null,
    clients: currentClientId ? [{ id: currentClientId, name: 'Cliente Teste' }] : [],
    workshopAccount: null,
    workshopPartnerships: [],
    activeWorkshopId: null,
  };
}

beforeEach(() => {
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  getVehicleLastRouteMapMock.mockReset();
  getVehicleLastRouteMapMock.mockResolvedValue(new Map([
    ['TEV8C85', { lastRouteDate: '2026-08-15', routeId: '425129405' }],
  ]));
  fromMock.mockReturnValue(chain({ data: [maintenanceRow()], error: null }));
  vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', DELUNA_CLIENT_ID);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.unstubAllEnvs();
});

function render() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Maintenance />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  });
}

async function waitForSettle() {
  await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
}

describe('Maintenance — última rota na listagem', () => {
  it('exibe a data da última rota dentro da célula Placa / Status para o tenant Deluna', async () => {
    useAuthMock.mockReturnValue(authFor(DELUNA_CLIENT_ID));

    render();
    await waitForSettle();

    expect(container.textContent).toContain('Últ. rota 15/08/2026');
  });

  it('não exibe o ID da rota na listagem de Manutenção', async () => {
    useAuthMock.mockReturnValue(authFor(DELUNA_CLIENT_ID));

    render();
    await waitForSettle();

    expect(container.textContent).not.toContain('425129405');
    expect(container.textContent).not.toContain('#425129405');
  });

  it('não chama nem renderiza o recurso para outro cliente', async () => {
    useAuthMock.mockReturnValue(authFor('client-outro'));

    render();
    await waitForSettle();

    expect(getVehicleLastRouteMapMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Últ. rota');
  });

  it('não renderiza a linha para veículo sem rota registrada', async () => {
    useAuthMock.mockReturnValue(authFor(DELUNA_CLIENT_ID));
    fromMock.mockReturnValue(chain({ data: [maintenanceRow({ id: 'mo-2', vehicles: { license_plate: 'XYZ9A99', model: 'FH' } })], error: null }));
    getVehicleLastRouteMapMock.mockResolvedValue(new Map());

    render();
    await waitForSettle();

    expect(container.textContent).not.toContain('Últ. rota');
  });
});
