import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, approveMock, rejectMock, approveGroupMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  approveMock: vi.fn(),
  rejectMock: vi.fn(),
  approveGroupMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentClient: { id: 'client-1' } }),
}));
vi.mock('../../services/paymentInstallmentService', () => ({
  listPaymentInstallments: listMock,
  approvePaymentInstallment: approveMock,
  rejectPaymentInstallment: rejectMock,
  approveMaintenancePaymentGroup: approveGroupMock,
}));

import PaymentApprovalsTab from './PaymentApprovalsTab';

import type { PaymentInstallment } from '../../types/payment';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function installment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'i1',
    maintenanceOrderId: 'os-1',
    sourceType: 'maintenance_order',
    clientId: 'client-1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 500,
    dueDate: '2026-08-10',
    status: 'pendente_aprovacao',
    paymentMethod: 'boleto',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    maintenanceOrderOs: 'OS-0001',
    workshopName: 'Oficina A',
    ...overrides,
  };
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
        <PaymentApprovalsTab />
      </QueryClientProvider>,
    );
  });
  return root;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  listMock.mockReset();
  approveMock.mockReset().mockResolvedValue(undefined);
  rejectMock.mockReset().mockResolvedValue(undefined);
  approveGroupMock.mockReset();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('PaymentApprovalsTab', () => {
  it('consulta somente sourceType maintenance_order (Extras nunca aparecem)', async () => {
    listMock.mockResolvedValue([]);
    renderTab();

    await waitForAssertion(() => {
      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'maintenance_order' }),
      );
    });
  });

  it('duas parcelas da mesma OS formam um único card (um botão "Ver parcelas")', async () => {
    listMock.mockResolvedValue([
      installment({ id: 'i1', installmentNumber: 1 }),
      installment({ id: 'i2', installmentNumber: 2 }),
    ]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-0001');
    });
    expect(
      Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.includes('Ver parcelas')),
    ).toHaveLength(1);
  });

  it('OS diferentes geram cards separados', async () => {
    listMock.mockResolvedValue([
      installment({ id: 'i1', maintenanceOrderId: 'os-1', maintenanceOrderOs: 'OS-0001' }),
      installment({ id: 'i2', maintenanceOrderId: 'os-2', maintenanceOrderOs: 'OS-0002' }),
    ]);
    renderTab();

    await waitForAssertion(() => {
      expect(
        Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.includes('Ver parcelas')),
      ).toHaveLength(2);
    });
  });

  it('"Ver parcelas" abre modal com a tabela; aprovação individual continua funcionando', async () => {
    listMock.mockResolvedValue([installment({ id: 'i1' })]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-0001');
    });

    const viewButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Ver parcelas'));
    act(() => { viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const approveButton = Array.from(dialog!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Aprovar') && !b.textContent.includes('todas'),
    );
    await act(async () => {
      approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(approveMock).toHaveBeenCalledWith('i1');
  });

  it('reprovação individual pela modal de parcelas continua funcionando', async () => {
    listMock.mockResolvedValue([installment({ id: 'i1' })]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-0001');
    });

    const viewButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Ver parcelas'));
    act(() => { viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const dialog = container.querySelector('[role="dialog"]');
    const rejectButton = Array.from(dialog!.querySelectorAll('button')).find((b) => b.textContent?.includes('Reprovar'));
    await act(async () => {
      rejectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(rejectMock).toHaveBeenCalledWith('i1');
  });

  it('não renderiza a seção "Já processados"', async () => {
    listMock.mockResolvedValue([installment({ id: 'i1' })]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-0001');
    });
    expect(container.textContent).not.toContain('Já processados');
  });

  it('"Aprovar todas" abre confirmação e envia snapshot completo (id/updatedAt) para a RPC', async () => {
    listMock.mockResolvedValue([
      installment({ id: 'i1', installmentNumber: 1, value: 300, updatedAt: '2026-07-01T00:00:00Z' }),
      installment({ id: 'i2', installmentNumber: 2, value: 200, updatedAt: '2026-07-02T00:00:00Z' }),
    ]);
    approveGroupMock.mockResolvedValue({ approvedCount: 2, approvedIds: ['i1', 'i2'] });
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-0001');
    });

    const approveAllButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Aprovar todas'));
    act(() => {
      approveAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toMatch(/R\$\s*500,00/);

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar aprovação'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(approveGroupMock).toHaveBeenCalledWith('os-1', [
      { id: 'i1', updatedAt: '2026-07-01T00:00:00Z' },
      { id: 'i2', updatedAt: '2026-07-02T00:00:00Z' },
    ]);
  });

  it('conflito mantém o card e exibe erro no modal, sem fechar', async () => {
    listMock.mockResolvedValue([installment({ id: 'i1' })]);
    approveGroupMock.mockRejectedValue(
      new Error('As parcelas desta OS foram alteradas. Nada foi aprovado; revise os dados novamente.'),
    );
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('OS-0001');
    });

    const approveAllButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Aprovar todas'));
    act(() => {
      approveAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar aprovação'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('revise os dados novamente');
    });
    expect(container.textContent).toContain('OS-0001');
  });
});
