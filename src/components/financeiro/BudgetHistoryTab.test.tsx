import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, listMock } = vi.hoisted(() => ({
  fromMock: vi.fn<(table: string) => unknown>(),
  listMock: vi.fn<() => MaintenanceOrder[]>(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../../services/budgetHistoryService', () => ({
  listReviewedBudgets: () => listMock(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentClient: { id: 'c1' } }),
}));

import BudgetHistoryTab from './BudgetHistoryTab';

import type { MaintenanceOrder } from '../../types/maintenance';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function makeOrder(over: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    id: 'o1',
    os: 'OS-001',
    licensePlate: 'SSB4J74',
    vehicleModel: undefined,
    workshop: 'Oficina Central',
    vehicleId: 'v1',
    workshopId: 'w1',
    entryDate: '2026-07-01',
    expectedExitDate: '2026-07-01',
    type: 'Corretiva',
    status: 'Orçamento aprovado',
    description: '',
    mechanicName: '',
    estimatedCost: 0,
    createdBy: 'João',
    createdAt: '2026-07-01T10:00:00Z',
    budgetStatus: 'aprovado',
    budgetDiscount: 0,
    budgetReviewedBy: 'Data Stack',
    budgetReviewedAt: '2026-08-07T10:00:00Z',
    ...over,
  } as MaintenanceOrder;
}

const approved = makeOrder({
  id: 'a1',
  os: 'OS-001',
  licensePlate: 'SSB4J74',
  budgetStatus: 'aprovado',
  budgetReviewedBy: 'Data Stack',
  budgetReviewedAt: '2026-08-07T10:00:00Z',
  approvedCost: 15896.11,
});

const rejected = makeOrder({
  id: 'r1',
  os: 'OS-100',
  licensePlate: 'XYZ9K88',
  budgetStatus: 'reprovado',
  budgetReviewedBy: 'Analista Frota',
  budgetReviewedAt: '2026-08-06T09:00:00Z',
  approvedCost: undefined,
  budgetRejectionReason: 'Valor acima do praticado',
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  fromMock.mockReset();
  listMock.mockReset();

  // Items query for expanded rows returns empty by default.
  fromMock.mockImplementation((table: string) => {
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
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => root.unmount());
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

function renderTab() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <BudgetHistoryTab />
      </QueryClientProvider>,
    );
  });
  return root;
}

describe('BudgetHistoryTab', () => {
  it('renderiza linha aprovada e reprovada com pílula, revisor e data', async () => {
    listMock.mockResolvedValue([approved, rejected]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
      expect(container.textContent).toContain('OS-100');
    });

    const pills = Array.from(container.querySelectorAll('.rounded-full'));
    const pillTexts = pills.map(p => p.textContent);
    expect(pillTexts).toContain('Aprovado');
    expect(pillTexts).toContain('Reprovado');

    expect(container.textContent).toContain('Data Stack');
    expect(container.textContent).toContain('Analista Frota');
  });

  it('filtrar por decisão "Reprovado" remove a linha aprovada', async () => {
    listMock.mockResolvedValue([approved, rejected]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
      expect(container.textContent).toContain('OS-100');
    });

    const decisionSelect = container.querySelector('select') as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(decisionSelect, 'reprovado');
      decisionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.textContent).not.toContain('OS-001');
      expect(container.textContent).toContain('OS-100');
    });
  });

  it('busca por placa parcial em minúsculos mantém só a linha correspondente', async () => {
    listMock.mockResolvedValue([approved, rejected]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
    });

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(searchInput, 'ssb4');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
      expect(container.textContent).not.toContain('OS-100');
    });
  });

  it('linha reprovada expandida exibe o motivo da reprovação', async () => {
    listMock.mockResolvedValue([approved, rejected]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-100');
    });

    const rejectedRow = Array.from(container.querySelectorAll('tbody tr')).find(
      tr => tr.textContent?.includes('OS-100'),
    ) as HTMLTableRowElement;
    act(() => {
      rejectedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Motivo da reprovação:');
      expect(container.textContent).toContain('Valor acima do praticado');
    });
  });

  it('estado vazio com filtro ativo mostra a mensagem de filtros aplicados', async () => {
    listMock.mockResolvedValue([approved]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
    });

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(searchInput, 'zzzzz');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Nenhum orçamento encontrado para os filtros aplicados.');
      expect(container.textContent).not.toContain('Nenhum orçamento aprovado ou reprovado até o momento.');
    });
  });

  it('botão "Baixar XLSX" fica desabilitado quando a lista filtrada está vazia', async () => {
    listMock.mockResolvedValue([approved]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-001');
    });

    const exportButton = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Baixar XLSX'),
    ) as HTMLButtonElement;
    expect(exportButton.disabled).toBe(false);

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(searchInput, 'zzzzz');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(exportButton.disabled).toBe(true);
    });
  });
});