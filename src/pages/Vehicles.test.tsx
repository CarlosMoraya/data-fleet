import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserRouter } from 'react-router-dom';

import Vehicles from './Vehicles';

const { fromMock, rpcMock, useAuthMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: Container;
let queryClient: QueryClient;

function vehicleRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'v1',
    client_id: 'c1',
    active: true,
    type: 'Truck',
    license_plate: 'ABC1D23',
    renavam: '123',
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
    driver_id: 'd-titular',
    drivers: { name: 'Titular João' },
    shippers: null,
    operational_units: null,
    ...over,
  };
}

function loanRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'l1',
    client_id: 'c1',
    vehicle_id: 'v1',
    driver_id: 'd-temp',
    started_at: '2026-07-26T10:00:00Z',
    ended_at: null,
    delivery_checklist_id: null,
    return_checklist_id: null,
    status: 'active',
    notes: 'xxxxxxxxxx',
    ended_notes: null,
    created_by: 'u1',
    ended_by: null,
    ended_reason: null,
    created_at: '2026-07-26T10:00:00Z',
    updated_at: '2026-07-26T10:00:00Z',
    drivers: { name: 'Temp Driver' },
    ...over,
  };
}

// Generic chainable mock for any `.from(table)` call. `order` resolves to the
// provided `data`. Everything else returns the chain itself so callers compose.
function chain(resp: { data?: unknown; error?: unknown }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    neq: vi.fn(() => self),
    not: vi.fn(() => self),
    in: vi.fn(() => self),
    is: vi.fn(() => self),
    gte: vi.fn(() => self),
    order: vi.fn(() => Promise.resolve({ data: resp.data ?? [], error: resp.error ?? null })),
    limit: vi.fn(() => self),
    single: vi.fn(() => Promise.resolve({ data: resp.data ?? null, error: resp.error ?? null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: resp.data ?? null, error: resp.error ?? null })),
    // Self is thenable: covers queries that end with `.eq`/`.not` (no `.order`).
    then: (resolve: (v: unknown) => void) => resolve({ data: resp.data ?? [], error: resp.error ?? null }),
  };
  return self;
}

beforeEach(() => {
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  rpcMock.mockReset();

  useAuthMock.mockReturnValue({
    user: { id: 'u1', role: 'Fleet Assistant', clientId: 'c1' },
    currentClient: { id: 'c1', name: 'Cliente Teste' },
    clients: [{ id: 'c1', name: 'Cliente Teste' }],
  });

  rpcMock.mockResolvedValue({ data: [], error: null });
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
          <Vehicles />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  });
}

describe('Vehicles — destaque de empréstimo ativo na lista', () => {
  it('linha com empréstimo ativo exibe "Emprestado ao Motorista {nome}"', async () => {
    const vehicle = vehicleRow();
    const loan = loanRow();

    fromMock.mockImplementation((table: string) => {
      if (table === 'vehicles') {
        return chain({ data: [vehicle] });
      }
      if (table === 'vehicle_loans') {
        // .select().in().eq() then await → eq must be thenable.
        const loanSelf = chain({ data: [loan], error: null });
        return loanSelf;
      }
      return chain({ data: [] });
    });

    render();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

    const text = container.textContent ?? '';
    expect(text).toContain('Emprestado ao Motorista');
    expect(text).toContain('Temp Driver');
  });
});