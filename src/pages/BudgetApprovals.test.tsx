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

import BudgetApprovals, { canApprove } from './BudgetApprovals';

import type { User } from '../types';

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
    budget_discount: 0,
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
    budget_discount: 0,
    vehicles: { license_plate: 'XYZ9K88' },
    workshops: { name: 'Oficina Central' },
    profiles: { name: 'João' },
  },
];

const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
// Livro-razão de decisões de orçamento: toda aprovação/reprovação grava uma linha.
const reviewInsertMock = vi.fn().mockResolvedValue({ error: null });

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  rpcMock.mockReset();
  updateMock.mockReset().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  reviewInsertMock.mockReset().mockResolvedValue({ error: null });

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
    if (table === 'maintenance_budget_reviews') {
      return { insert: reviewInsertMock };
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
    expect(reviewInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'reprovado',
        reason: 'Valor acima do combinado',
        decided_by: 'user-1',
      }),
    );
  });
});

describe('BudgetApprovals — embedded', () => {
  it('modo standalone (default) mantém o header próprio', async () => {
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
      expect(container.textContent).toContain('Aprovação de Orçamentos');
    });
  });

  it('modo embedded remove o header próprio', async () => {
    const root = createRoot(container);
    container.__reactRoot = root;

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BudgetApprovals embedded />
        </QueryClientProvider>,
      );
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
    });
    expect(container.textContent).not.toContain('Aprovação de Orçamentos');
  });
});

describe('BudgetApprovals — desconto e total líquido', () => {
  it('canApprove recebe o total líquido: 12.000 com desconto geral de 3.000 é aprovável por alçada de 10.000', () => {
    const user = {
      id: 'u1',
      name: 'Analyst',
      email: 'a@b.com',
      role: 'Fleet Analyst',
      clientId: 'c1',
      budgetApprovalLimit: 10000,
    } as unknown as User;

    // 12000 bruto - 3000 de desconto geral = 9000 líquido
    expect(canApprove(user, 9000, { itemsLoading: false, hasItems: true })).toBe(true);
    // Confirma que passar o bruto rejeitaria — eixo do motivo do desconto
    expect(canApprove(user, 12000, { itemsLoading: false, hasItems: true })).toBe(false);
  });

  it('aprovação grava approved_cost líquido (desconto por item + desconto geral)', async () => {
    // Mock o from para devolver itens com discount e a OS com budget_discount
    const itemRows = [
      { quantity: 2, value: 6000, discount: 0 },
      { quantity: 1, value: 2000, discount: 1000 },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                eq: () => Promise.resolve({
                  data: [{
                    ...orderRows[0],
                    budget_discount: 3000,
                  }],
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      if (table === 'maintenance_budget_items') {
        // A query da OrderRow usa select('*').eq(...).order('sort_order');
        // a mutation usa select('quantity, value, discount').eq(...) direto.
        // O mesmo shape precisa servir aos dois padrões.
        const makePromise = () => {
          const p: Promise<{ data: unknown; error: unknown }> = Promise.resolve({ data: itemRows, error: null });
          (p as unknown as { order: () => Promise<{ data: unknown; error: unknown }> }).order = () =>
            Promise.resolve({ data: itemRows, error: null });
          return p;
        };
        return {
          select: () => ({
            eq: () => makePromise(),
          }),
        };
      }
      if (table === 'maintenance_budget_reviews') {
      return { insert: reviewInsertMock };
    }
    throw new Error(`unexpected table: ${table}`);
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
      expect(container.textContent).toContain('OS-001');
    });

    const approveButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Aprovar'));
    await act(async () => {
      approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Bruto = 2*6000 + 1*2000 = 14000
    // Descontos: item 1000 + geral 3000 = 4000
    // Líquido = 10000
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        budget_status: 'aprovado',
        approved_cost: 10000,
      }),
    );
  });
});
