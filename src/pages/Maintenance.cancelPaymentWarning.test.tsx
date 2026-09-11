import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, exposureMock, cancelMock, authState } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  exposureMock: vi.fn<(id: string) => Promise<{ count: number; total: number }>>(),
  cancelMock: vi.fn<(id: string, cancelledById: string | null) => Promise<void>>(),
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

vi.mock('../services/paymentInstallmentService', () => ({
  getMaintenanceOrderPaymentExposure: exposureMock,
}));

vi.mock('../services/maintenanceService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/maintenanceService')>()),
  cancelMaintenanceOrder: cancelMock,
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
    status: 'Serviço em execução',
    description: 'Troca de pastilhas',
    mechanic_name: null,
    estimated_cost: 0,
    approved_cost: 1500,
    created_by_id: 'user-1',
    notes: null,
    workshop_os_number: null,
    current_km: null,
    budget_pdf_url: null,
    budget_status: 'aprovado',
    budget_discount: 0,
    budget_reviewed_by: null,
    budget_reviewed_at: null,
    budget_rejection_reason: null,
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
  exposureMock.mockReset();
  cancelMock.mockReset().mockResolvedValue(undefined);
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

describe('Maintenance — aviso de parcelas no cancelamento', () => {
  it('consulta as parcelas da OS ao abrir o modal', async () => {
    exposureMock.mockResolvedValue({ count: 0, total: 0 });
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(exposureMock).toHaveBeenCalledWith('order-1');
    });
  });

  it('avisa parcelas lançadas e troca o rótulo do botão', async () => {
    exposureMock.mockResolvedValue({ count: 2, total: 1500 });
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Esta OS já tem 2 parcela(s) de pagamento lançada(s), somando R$\u00a01.500,00.');
    });
    expect(findButtonByText('Cancelar mesmo assim')).toBeTruthy();
    expect(findButtonByText('Confirmar Cancelamento')).toBeFalsy();
  });

  it('mantém o modal original quando não há parcelas', async () => {
    exposureMock.mockResolvedValue({ count: 0, total: 0 });
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      const btn = findButtonByText('Confirmar Cancelamento');
      expect(btn).toBeTruthy();
      expect(btn?.disabled).toBe(false);
    });
    expect(container.textContent).not.toContain('parcela(s) de pagamento');
  });

  it('bloqueia a confirmação enquanto verifica as parcelas', async () => {
    exposureMock.mockReturnValue(new Promise<never>(() => undefined));
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(exposureMock).toHaveBeenCalledWith('order-1');
      const btn = findButtonByText('Confirmar Cancelamento');
      expect(btn).toBeTruthy();
      expect(btn?.disabled).toBe(true);
    });

    act(() => {
      findButtonByText('Confirmar Cancelamento')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('avisa quando não consegue verificar as parcelas', async () => {
    exposureMock.mockRejectedValue(new Error('rede'));
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Não foi possível verificar se esta OS tem parcelas de pagamento lançadas.');
    });
    expect(findButtonByText('Cancelar mesmo assim')).toBeTruthy();
  });

  it('"Cancelar mesmo assim" cancela a OS', async () => {
    exposureMock.mockResolvedValue({ count: 2, total: 1500 });
    cancelMock.mockResolvedValue(undefined);
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar mesmo assim')).toBeTruthy();
    });

    await act(async () => {
      findButtonByText('Cancelar mesmo assim')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cancelMock).toHaveBeenCalledWith('order-1', 'user-1');
  });
});
