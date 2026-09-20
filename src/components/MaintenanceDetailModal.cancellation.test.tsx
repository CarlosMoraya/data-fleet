import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'Fleet Assistant' } }),
}));
vi.mock('../hooks/useStorageFileUrl', () => ({
  useStorageFileUrl: () => ({ url: null, isLoading: false, error: null }),
}));
vi.mock('./PartPhotosSection', () => ({ default: () => null }));
vi.mock('./BudgetItemsTable', () => ({ default: () => null }));

import MaintenanceDetailModal from './MaintenanceDetailModal';

import type { MaintenanceOrder } from '../types/maintenance';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function makeOrder(over: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    id: 'order-1',
    os: 'OS-001',
    licensePlate: 'ABC1D23',
    workshop: 'Oficina Central',
    vehicleId: 'v1',
    workshopId: 'w1',
    entryDate: '2026-09-01',
    expectedExitDate: '2026-09-10',
    type: 'Corretiva',
    status: 'Cancelado',
    description: 'Troca de pastilhas',
    mechanicName: 'João',
    estimatedCost: 0,
    createdBy: 'Ana',
    createdAt: '2026-09-01T10:00:00',
    budgetStatus: 'sem_orcamento',
    ...over,
  };
}

function renderOrder(order: MaintenanceOrder) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MaintenanceDetailModal order={order} onClose={() => undefined} />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('MaintenanceDetailModal — cancelamento', () => {
  it('exibe autor, data e motivo quando a OS está cancelada', () => {
    const order = makeOrder({
      cancelledByName: 'Ana Souza',
      cancelledAt: '2026-09-18T12:00:00',
      cancellationReason: 'Veículo vendido antes do reparo',
    });
    renderOrder(order);

    expect(container.textContent).toContain('Ana Souza');
    expect(container.textContent).toContain('18/09/2026 12:00');
    expect(container.textContent).toContain('Veículo vendido antes do reparo');
  });

  it('exibe rótulos de ausência em OS cancelada sem motivo nem autor', () => {
    const order = makeOrder({
      cancelledByName: undefined,
      cancellationReason: undefined,
      cancelledAt: '2026-09-18T12:00:00',
    });
    renderOrder(order);

    expect(container.textContent).toContain('Não informado');
    expect(container.textContent).toContain('Não identificado');
  });

  it('não exibe o bloco em OS não cancelada', () => {
    const order = makeOrder({
      status: 'Serviço em execução',
      cancelledByName: 'Ana Souza',
      cancellationReason: 'Veículo vendido antes do reparo',
    });
    renderOrder(order);

    expect(container.textContent).toContain('OS-001');
    expect(container.querySelector('[data-testid="maintenance-cancellation-block"]')).toBeNull();
    expect(container.textContent).not.toContain('Veículo vendido antes do reparo');
  });
});
