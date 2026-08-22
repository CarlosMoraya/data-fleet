import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, reopenRejectedBudgetMock, authState } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  reopenRejectedBudgetMock: vi.fn(),
  authState: {
    user: { id: 'user-1', name: 'Ana', role: 'Fleet Assistant', clientId: 'client-1' } as Record<string, unknown>,
    currentClient: { id: 'client-1', name: 'Transportadora' } as Record<string, unknown> | null,
    workshopAccount: null as unknown,
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    currentClient: authState.currentClient,
    clients: [],
    workshopAccount: authState.workshopAccount,
    activeWorkshopId: null,
    workshopPartnerships: [],
  }),
}));

vi.mock('react-router-dom', () => ({
  Navigate: () => null,
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../services/maintenanceBudgetReviewService', () => ({
  reopenRejectedBudget: reopenRejectedBudgetMock,
}));

// O formulário completo não participa destes cenários.
vi.mock('../components/MaintenanceForm', () => ({ default: () => null }));
vi.mock('../components/MaintenanceDetailModal', () => ({ default: () => null }));

import Maintenance from './Maintenance';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    client_id: 'client-1',
    vehicle_id: 'vehicle-1',
    workshop_id: 'workshop-1',
    os_number: 'OS-001',
    entry_date: '2026-08-01',
    expected_exit_date: '2026-08-10',
    actual_exit_date: null,
    type: 'Corretiva',
    status: 'Aguardando orçamento',
    description: 'Troca de pastilhas',
    mechanic_name: null,
    estimated_cost: 0,
    approved_cost: null,
    created_by_id: 'user-1',
    notes: null,
    workshop_os_number: null,
    current_km: null,
    budget_pdf_url: null,
    budget_status: 'reprovado',
    budget_discount: 0,
    budget_reviewed_by: null,
    budget_reviewed_at: null,
    budget_rejection_reason: 'Valor acima do praticado',
    cancelled_at: null,
    cancelled_by_id: null,
    warranty_revision_event_id: null,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    vehicles: { license_plate: 'ABC1D23', model: 'FH 540' },
    workshops: { name: 'Oficina Central' },
    profiles: { name: 'Ana' },
    ...over,
  };
}

function mockOrders(rows: Record<string, unknown>[]) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'maintenance_orders') {
      return {
        select: () => ({
          order: () => ({
            eq: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

async function renderPage() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Maintenance />
      </QueryClientProvider>,
    );
  });
  await waitForAssertion(() => {
    expect(container.textContent).toContain('OS-001');
  });
}

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
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

function findButtonByTitle(title: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(b => b.getAttribute('title') === title);
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  authState.user = { id: 'user-1', name: 'Ana', role: 'Fleet Assistant', clientId: 'client-1' };
  authState.currentClient = { id: 'client-1', name: 'Transportadora' };
  authState.workshopAccount = null;

  fromMock.mockReset();
  reopenRejectedBudgetMock.mockReset().mockResolvedValue(undefined);
  window.sessionStorage.clear();
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

describe('Maintenance — reabrir orçamento', () => {
  it('cenário feliz: OS reprovada exibe a ação e a confirmação chama o serviço com o motivo', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    const reopenButton = findButtonByTitle('Reabrir orçamento');
    expect(reopenButton).toBeTruthy();

    act(() => {
      reopenButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Reabrir Orçamento');
    expect(container.textContent).toContain('Justificativa da reabertura');

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(textarea, 'Oficina corrigiu o valor da mão de obra');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      findButtonByText('Confirmar reabertura')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(reopenRejectedBudgetMock).toHaveBeenCalledWith({
      maintenanceOrderId: 'order-1',
      clientId: 'client-1',
      reason: 'Oficina corrigiu o valor da mão de obra',
      profileId: 'user-1',
    });
  });

  it('cenário de erro: justificativa vazia mantém o botão desabilitado e não chama o serviço', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Reabrir orçamento')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirm = findButtonByText('Confirmar reabertura');
    expect(confirm?.disabled).toBe(true);

    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(reopenRejectedBudgetMock).not.toHaveBeenCalled();
  });

  it('CRÍTICO: OS com orçamento aprovado não exibe a ação de reabrir', async () => {
    mockOrders([makeRow({ budget_status: 'aprovado', status: 'Orçamento aprovado', approved_cost: 350 })]);
    await renderPage();

    expect(findButtonByTitle('Reabrir orçamento')).toBeUndefined();
  });

  it('edge case: conta de oficina não vê a ação numa OS reprovada', async () => {
    authState.user = { id: 'user-2', name: 'Oficina', role: 'Workshop', clientId: null, workshopId: 'workshop-1' };
    mockOrders([makeRow()]);
    await renderPage();

    expect(findButtonByTitle('Reabrir orçamento')).toBeUndefined();
  });

  it('edge case: o modal exibe o motivo da reprovação anterior', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Reabrir orçamento')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Motivo da reprovação anterior:');
    expect(container.textContent).toContain('Valor acima do praticado');
  });
});
