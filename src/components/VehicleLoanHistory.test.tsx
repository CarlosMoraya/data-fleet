import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VehicleLoanHistory from './VehicleLoanHistory';

import type { VehicleLoan } from '../types/vehicleLoan';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: ReactContainer;
let queryClient: QueryClient;

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

function row(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'l1',
    client_id: 'c1',
    vehicle_id: 'v1',
    driver_id: 'd1',
    started_at: '2026-07-26T10:00:00Z',
    ended_at: null,
    delivery_checklist_id: null,
    return_checklist_id: null,
    status: 'active',
    notes: 'xxxxxxxxxx',
    ended_notes: null,
    created_by: 'u1',
    created_by_name: 'Ana Coordenadora',
    ended_by: null,
    ended_by_name: null,
    ended_reason: null,
    delivery_checklist_at: null,
    return_checklist_at: null,
    created_at: '2026-07-26T10:00:00Z',
    updated_at: '2026-07-26T10:00:00Z',
    driver_name: 'João',
    ...over,
  };
}

beforeEach(() => {
  container = document.createElement('div') as ReactContainer;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rpcMock.mockReset();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  document.body.removeChild(container);
});

function renderHistory(props: Partial<React.ComponentProps<typeof VehicleLoanHistory>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <VehicleLoanHistory vehicleId="v1" onSelect={() => {}} {...props} />
      </QueryClientProvider>,
    );
  });
}

describe('VehicleLoanHistory', () => {
  it('renderiza linhas e aplica filtro por status', async () => {
    const data = [
      row({ id: 'l1', status: 'active', driver_name: 'João' }),
      row({ id: 'l2', status: 'completed', ended_reason: 'return_checklist', driver_name: 'Maria', ended_at: '2026-07-27T10:00:00Z' }),
    ];
    rpcMock.mockResolvedValue({ data, error: null });

    renderHistory();

    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    let rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(container.textContent).toContain('João');
    expect(container.textContent).toContain('Maria');

    const ativosBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Ativos',
    );
    expect(ativosBtn).toBeDefined();
    act(() => ativosBtn?.click());

    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(container.textContent).toContain('João');
    expect(container.textContent).not.toContain('Maria');
  });

  it('chama onSelect ao clicar em uma linha', async () => {
    const onSelect = vi.fn();
    rpcMock.mockResolvedValue({ data: [row()], error: null });
    renderHistory({ onSelect });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const firstRow = container.querySelector('tbody tr');
    expect(firstRow).not.toBeNull();
    act(() => firstRow?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const loan = onSelect.mock.calls[0][0] as VehicleLoan;
    expect(loan.id).toBe('l1');
    expect(loan.driverName).toBe('João');
  });
});