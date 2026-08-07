import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


import Maintenance from './Maintenance';

const { fromMock, useAuthMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  useAuthMock: vi.fn(),
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

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: Container;
let queryClient: QueryClient;

function chain(resp: { data?: unknown; error?: unknown }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    order: vi.fn(() => Promise.resolve({ data: resp.data ?? [], error: resp.error ?? null })),
    then: (resolve: (v: unknown) => void) => resolve({ data: resp.data ?? [], error: resp.error ?? null }),
  };
  return self;
}

beforeEach(() => {
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  document.body.removeChild(container);
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

describe('Maintenance export button visibility', () => {
  it('shows Baixar XLSX button when role is Fleet Assistant with a selected client', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'u1', role: 'Fleet Assistant', clientId: 'c1' },
      currentClient: { id: 'c1', name: 'Cliente Teste' },
      clients: [{ id: 'c1', name: 'Cliente Teste' }],
      workshopAccount: null,
      workshopPartnerships: [],
      activeWorkshopId: null,
    });

    fromMock.mockReturnValue(chain({ data: [], error: null }));

    render();
    await waitForSettle();

    const buttons = container.querySelectorAll('button');
    const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Baixar XLSX'));
    expect(exportBtn).toBeTruthy();
  });

  it('does not show Baixar XLSX button when role is Workshop', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'u2', role: 'Workshop', clientId: null },
      currentClient: null,
      clients: [],
      workshopAccount: { id: 'w1', workshopId: 'ws1' },
      workshopPartnerships: [],
    });

    fromMock.mockReturnValue(chain({ data: [], error: null }));

    render();
    await waitForSettle();

    const buttons = container.querySelectorAll('button');
    const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Baixar XLSX'));
    expect(exportBtn).toBeFalsy();
  });
});
