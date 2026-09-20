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
    status: 'Serviço em execução',
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

describe('MaintenanceDetailModal — exceção de orçamento', () => {
  it('exibe o bloco completo quando há exceção registrada', () => {
    renderOrder(makeOrder({
      budgetOverrideReason: 'peça de segurança',
      budgetOverrideAt: '2026-09-20T12:00:00Z',
      budgetOverrideByName: 'Mariana',
    }));

    expect(container.querySelector('[data-testid="budget-override-block"]')).not.toBeNull();
    expect(container.textContent).toContain('Mariana');
    expect(container.textContent).toContain('peça de segurança');
  });

  it('não exibe o bloco quando não há exceção', () => {
    renderOrder(makeOrder({ budgetOverrideReason: undefined }));

    expect(container.querySelector('[data-testid="budget-override-block"]')).toBeNull();
  });

  it('usa o rótulo padrão quando o autor não pôde ser lido', () => {
    renderOrder(makeOrder({
      budgetOverrideReason: 'urgência',
      budgetOverrideByName: undefined,
    }));

    expect(container.querySelector('[data-testid="budget-override-block"]')).not.toBeNull();
    expect(container.textContent).toContain('Não identificado');
  });
});
