import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, selectMock, orderMock, eqMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  orderMock: vi.fn(),
  eqMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'Coordinator' },
    currentClient: { id: 'client-1' },
    clients: [{ id: 'client-1', name: 'Cliente 1' }],
  }),
}));

import ActionPlans from './ActionPlans';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

const rows = [
  {
    id: 'plan-1',
    client_id: 'client-1',
    checklist_id: 'checklist-1',
    checklist_response_id: null,
    vehicle_id: 'vehicle-1',
    reported_by: null,
    suggested_action: 'Trocar pastilha de freio',
    observed_issue: null,
    photo_url: null,
    status: 'pending',
    name: 'Plano A',
    responsible_id: null,
    due_date: null,
    assigned_by: null,
    claimed_by: null,
    claimed_at: null,
    conclusion_evidence_url: null,
    work_order_number: null,
    completion_notes: null,
    completed_by: null,
    completed_at: null,
    latitude: null,
    longitude: null,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    vehicles: { license_plate: 'ABC1D23' },
  },
  {
    id: 'plan-2',
    client_id: 'client-1',
    checklist_id: 'checklist-2',
    checklist_response_id: null,
    vehicle_id: 'vehicle-2',
    reported_by: null,
    suggested_action: 'Verificar suspensão',
    observed_issue: null,
    photo_url: null,
    status: 'pending',
    name: 'Plano B',
    responsible_id: null,
    due_date: null,
    assigned_by: null,
    claimed_by: null,
    claimed_at: null,
    conclusion_evidence_url: null,
    work_order_number: null,
    completion_notes: null,
    completed_by: null,
    completed_at: null,
    latitude: null,
    longitude: null,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    vehicles: { license_plate: 'XYZ9K88' },
  },
];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  selectMock.mockReset();
  orderMock.mockReset();
  eqMock.mockReset();
  rpcMock.mockReset();

  eqMock.mockResolvedValue({ data: rows, error: null });
  orderMock.mockReturnValue({ eq: eqMock });
  selectMock.mockReturnValue({ order: orderMock });
  fromMock.mockReturnValue({ select: selectMock });

  rpcMock.mockResolvedValue({
    data: [{ vehicle_id: 'vehicle-1', effective_km: 12345, is_corrected: false }],
    error: null,
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function waitForAssertion(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError;
}

describe('ActionPlans — Último Km abaixo da placa', () => {
  it('exibe o último Km quando há leitura e o fallback quando não há', async () => {
    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ActionPlans />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Último Km: 12.345 km');
    });
    expect(container.textContent).toContain('Último Km: sem leitura');
  });

  it('exibe (Editado) quando o último Km vier de leitura corrigida', async () => {
    rpcMock.mockResolvedValue({
      data: [{ vehicle_id: 'vehicle-1', effective_km: 12345, is_corrected: true }],
      error: null,
    });

    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ActionPlans />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Último Km: 12.345 km (Editado)');
    });
  });
});
