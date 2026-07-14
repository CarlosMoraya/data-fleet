import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
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
    user: { id: 'user-1', role: 'Coordinator', budgetApprovalLimit: 0 },
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import BudgetApprovals from './BudgetApprovals';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

const orderRows = [
  {
    id: 'order-1',
    os_number: 'OS-001',
    entry_date: '2026-07-01',
    workshop_os_number: null,
    current_km: null,
    budget_pdf_url: null,
    created_at: '2026-07-01T10:00:00Z',
    vehicle_id: 'vehicle-1',
    vehicles: { license_plate: 'ABC1D23' },
    workshops: { name: 'Oficina Central' },
    profiles: { name: 'João' },
  },
  {
    id: 'order-2',
    os_number: 'OS-002',
    entry_date: '2026-07-02',
    workshop_os_number: null,
    current_km: null,
    budget_pdf_url: null,
    created_at: '2026-07-02T10:00:00Z',
    vehicle_id: 'vehicle-2',
    vehicles: { license_plate: 'XYZ9K88' },
    workshops: { name: 'Oficina Central' },
    profiles: { name: 'João' },
  },
];

const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  rpcMock.mockReset();
  updateMock.mockReset().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

  fromMock.mockImplementation((table: string) => {
    if (table === 'maintenance_orders') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              eq: () => Promise.resolve({ data: orderRows, error: null }),
            }),
          }),
        }),
        update: updateMock,
      };
    }
    if (table === 'maintenance_budget_items') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  rpcMock.mockResolvedValue({
    data: [{ vehicle_id: 'vehicle-1', effective_km: 54321, is_corrected: false }],
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

describe('BudgetApprovals — Último Km abaixo da placa', () => {
  it('exibe o último Km quando há leitura e o fallback quando não há', async () => {
    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BudgetApprovals />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Último Km: 54.321 km');
    });
    expect(container.textContent).toContain('Último Km: sem leitura');
  });

  it('exibe (Editado) quando o último Km vier de leitura corrigida', async () => {
    rpcMock.mockResolvedValue({
      data: [{ vehicle_id: 'vehicle-1', effective_km: 54321, is_corrected: true }],
      error: null,
    });

    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BudgetApprovals />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Último Km: 54.321 km (Editado)');
    });
  });
});

describe('BudgetApprovals — motivo de reprovação', () => {
  it('clicar "Reprovar" abre o modal e "Confirmar reprovação" fica desabilitado com motivo vazio', async () => {
    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BudgetApprovals />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
    });

    const rejectButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Reprovar'));
    act(() => {
      rejectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Reprovar Orçamento');
    const confirmButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Confirmar reprovação')) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it('preencher o motivo e confirmar chama update com budget_status reprovado e o motivo informado', async () => {
    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BudgetApprovals />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
    });

    const rejectButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Reprovar'));
    act(() => {
      rejectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(textarea, 'Valor acima do combinado');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Confirmar reprovação'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        budget_status: 'reprovado',
        budget_rejection_reason: 'Valor acima do combinado',
      }),
    );
  });
});
