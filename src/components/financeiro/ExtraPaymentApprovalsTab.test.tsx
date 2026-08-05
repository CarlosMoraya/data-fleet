import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listRequestsMock, listInstallmentsMock, approveGroupMock, rejectMock } = vi.hoisted(() => ({
  listRequestsMock: vi.fn(),
  listInstallmentsMock: vi.fn(),
  approveGroupMock: vi.fn(),
  rejectMock: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentClient: { id: 'client-1' } }),
}));
vi.mock('../../services/serviceExpenseService', () => ({
  listExtraPaymentRequests: listRequestsMock,
  approveExtraPaymentRequestGroup: approveGroupMock,
  rejectExtraPaymentRequest: rejectMock,
}));
vi.mock('../../services/paymentInstallmentService', () => ({
  listExtraPaymentInstallments: listInstallmentsMock,
}));
vi.mock('./ExtraPaymentViewModal', () => ({
  default: ({ request, onClose }: { request: { requestNumber: string }; onClose: () => void }) => (
    <div data-testid="extra-payment-view-modal">
      <span>Detalhes de {request.requestNumber}</span>
      <button type="button" onClick={onClose}>Fechar</button>
    </div>
  ),
}));

import ExtraPaymentApprovalsTab from './ExtraPaymentApprovalsTab';

import type { PaymentInstallment } from '../../types/payment';
import type { ExtraPaymentRequest } from '../../types/serviceExpense';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function baseRequest(overrides: Partial<ExtraPaymentRequest> = {}): ExtraPaymentRequest {
  return {
    id: 'epr-1',
    clientId: 'client-1',
    requestNumber: 'PE-2607-0001',
    category: 'guincho',
    serviceDate: '2026-07-10',
    supplierName: 'Guincho Rápido LTDA',
    amount: 350,
    status: 'pendente_aprovacao',
    createdById: 'user-1',
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    ...overrides,
  };
}

function baseInstallment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'inst-1',
    sourceType: 'extra_payment',
    extraPaymentRequestId: 'epr-1',
    clientId: 'client-1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 350,
    dueDate: '2026-08-01',
    status: 'pendente_aprovacao',
    paymentMethod: 'pix',
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
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
        <ExtraPaymentApprovalsTab />
      </QueryClientProvider>,
    );
  });
  return root;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  listRequestsMock.mockReset();
  listInstallmentsMock.mockReset().mockResolvedValue([]);
  approveGroupMock.mockReset();
  rejectMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('ExtraPaymentApprovalsTab', () => {
  it('lista pedidos pendentes', async () => {
    listRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });
  });

  it('não renderiza processados nem o título antigo', async () => {
    listRequestsMock.mockResolvedValue([
      baseRequest(),
      baseRequest({ id: 'epr-2', status: 'aprovado', requestNumber: 'PE-2607-0002' }),
    ]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });
    expect(container.textContent).not.toContain('PE-2607-0002');
    expect(container.textContent).not.toContain('Já processados');
  });

  it('pedido com várias parcelas mostra quantidade e soma', async () => {
    listRequestsMock.mockResolvedValue([baseRequest({ amount: 500 })]);
    listInstallmentsMock.mockResolvedValue([
      baseInstallment({ id: 'i1', installmentNumber: 1, value: 300 }),
      baseInstallment({ id: 'i2', installmentNumber: 2, value: 200 }),
    ]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('2 parcela(s)');
    });
    expect(container.textContent).toMatch(/soma:.*R\$\s*500,00/);
  });

  it('card não lista parcelas nem ações individuais — só "Ver detalhes" mostra as parcelas (somente leitura)', async () => {
    listRequestsMock.mockResolvedValue([baseRequest()]);
    listInstallmentsMock.mockResolvedValue([baseInstallment()]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });
    expect(container.querySelector('table')).toBeNull();
  });

  it('pedido sem parcelas bloqueia a aprovação', async () => {
    listRequestsMock.mockResolvedValue([baseRequest()]);
    listInstallmentsMock.mockResolvedValue([]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('não possui parcelas');
    });
    const approveButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Aprovar pedido e parcelas')) as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);
  });

  it('soma divergente bloqueia a aprovação', async () => {
    listRequestsMock.mockResolvedValue([baseRequest({ amount: 999 })]);
    listInstallmentsMock.mockResolvedValue([baseInstallment({ value: 350 })]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('não corresponde ao valor do pedido');
    });
    const approveButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Aprovar pedido e parcelas')) as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);
  });

  it('aprovar chama a RPC do cabeçalho uma vez com snapshot completo', async () => {
    listRequestsMock.mockResolvedValue([baseRequest({ amount: 350, updatedAt: '2026-07-10T00:00:00Z' })]);
    listInstallmentsMock.mockResolvedValue([baseInstallment({ id: 'i1', value: 350, updatedAt: '2026-07-10T01:00:00Z' })]);
    approveGroupMock.mockResolvedValue({ approvedCount: 1, approvedIds: ['i1'] });
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });

    const approveButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Aprovar pedido e parcelas'));
    act(() => { approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar aprovação'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(approveGroupMock).toHaveBeenCalledTimes(1);
    expect(approveGroupMock).toHaveBeenCalledWith('epr-1', '2026-07-10T00:00:00Z', [
      { id: 'i1', updatedAt: '2026-07-10T01:00:00Z' },
    ]);
  });

  it('conflito na aprovação mantém o pedido visível e exibe erro', async () => {
    listRequestsMock.mockResolvedValue([baseRequest()]);
    listInstallmentsMock.mockResolvedValue([baseInstallment()]);
    approveGroupMock.mockRejectedValue(new Error('Este pedido foi alterado. Nada foi aprovado; revise novamente.'));
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });

    const approveButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Aprovar pedido e parcelas'));
    act(() => { approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar aprovação'));
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('revise novamente');
    });
    expect(container.textContent).toContain('PE-2607-0001');
  });

  it('reprovar exige motivo obrigatório', async () => {
    listRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });

    const rejectButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Reprovar'));
    act(() => { rejectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar reprovação'));
    expect(confirmButton?.hasAttribute('disabled')).toBe(true);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(textarea, 'Documentação incompleta');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const confirmButtonAfter = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar reprovação'));
    await act(async () => {
      confirmButtonAfter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(rejectMock).toHaveBeenCalledWith('epr-1', 'Documentação incompleta');
  });

  it('"Ver detalhes" abre o modal de visualização existente', async () => {
    listRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2607-0001');
    });

    const viewButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Ver detalhes'));
    act(() => { viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(container.querySelector('[data-testid="extra-payment-view-modal"]')).not.toBeNull();
  });
});
