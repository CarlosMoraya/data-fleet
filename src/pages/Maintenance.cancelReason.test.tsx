import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, exposureMock, cancelMock, updateStatusMock, authState } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  exposureMock: vi.fn<(id: string) => Promise<{ count: number; total: number }>>(),
  cancelMock: vi.fn<(id: string, cancelledById: string | null, reason: string) => Promise<void>>(),
  updateStatusMock: vi.fn(),
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
  updateMaintenanceStatus: updateStatusMock,
}));

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
    cancellation_reason: null,
    cancelled_by: null,
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

function fillCancelReason(value: string) {
  const el = document.querySelector('#cancel-reason') as HTMLTextAreaElement | null;
  if (!el) throw new Error('textarea #cancel-reason não encontrado');
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ) as { set?: (this: HTMLTextAreaElement, value: string) => void } | undefined;
  act(() => {
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  authState.user = { id: 'user-1', name: 'Ana', role: 'Fleet Assistant', clientId: 'client-1' };
  authState.currentClient = { id: 'client-1', name: 'Transportadora' };
  authState.workshopAccount = null;

  fromMock.mockReset();
  exposureMock.mockReset().mockResolvedValue({ count: 0, total: 0 });
  cancelMock.mockReset().mockResolvedValue(undefined);
  updateStatusMock.mockReset();
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

describe('Maintenance — motivo do cancelamento', () => {
  it('motivo vazio mantém o cancelamento bloqueado', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Preenche e espera habilitar: prova que a consulta de parcelas terminou e
    // que o botao NAO esta desabilitado por causa do carregamento.
    fillCancelReason('Motivo temporario');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar Cancelamento')?.disabled).toBe(false);
    });

    // Agora esvazia: o unico motivo possivel de disabled passa a ser o campo vazio.
    fillCancelReason('');

    const btn = findButtonByText('Confirmar Cancelamento');
    expect(btn?.disabled).toBe(true);
    act(() => {
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('motivo só com espaços não habilita a confirmação', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Mesma tecnica do cenario anterior: primeiro prova que o carregamento acabou.
    fillCancelReason('Motivo temporario');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar Cancelamento')?.disabled).toBe(false);
    });

    fillCancelReason('   ');

    expect(findButtonByText('Confirmar Cancelamento')?.disabled).toBe(true);
  });

  it('motivo preenchido envia id, autor e motivo', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    fillCancelReason('Serviço não será mais executado');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar Cancelamento')?.disabled).toBe(false);
    });
    await act(async () => {
      findButtonByText('Confirmar Cancelamento')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cancelMock).toHaveBeenCalledWith('order-1', 'user-1', 'Serviço não será mais executado');
  });

  it('a opção Cancelar do menu Ações abre o modal e não muda o status', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    const actions = container.querySelector('select[title="Ações"]') as HTMLSelectElement | null;
    if (!actions) throw new Error('select Ações não encontrado');
    act(() => {
      actions.value = 'Cancelar';
      actions.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Cancelar Ordem de Serviço');
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it('Voltar limpa o motivo digitado', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    fillCancelReason('texto descartado');
    act(() => {
      findButtonByText('Voltar')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect((document.querySelector('#cancel-reason') as HTMLTextAreaElement).value).toBe('');
  });

  it('erro do servidor aparece dentro do modal', async () => {
    cancelMock.mockRejectedValue(new Error('Motivo do cancelamento e obrigatorio'));
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    fillCancelReason('qualquer motivo');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar Cancelamento')?.disabled).toBe(false);
    });
    await act(async () => {
      findButtonByText('Confirmar Cancelamento')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Motivo do cancelamento e obrigatorio');
      expect(container.textContent).toContain('Cancelar Ordem de Serviço');
    });
  });

  it('o campo de motivo respeita o teto de 500 caracteres', async () => {
    mockOrders([makeRow()]);
    await renderPage();

    act(() => {
      findButtonByTitle('Cancelar OS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect((document.querySelector('#cancel-reason') as HTMLTextAreaElement).maxLength).toBe(500);
  });
});
