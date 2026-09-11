import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, listExtraPaymentRequestsMock, cancelExtraPaymentRequestMock, getExtraPaymentAuditorsMock, listPaymentInstallmentsMock } = vi.hoisted(() => ({
  authState: { id: 'user-1', role: 'Fleet Assistant' as string },
  listExtraPaymentRequestsMock: vi.fn(),
  cancelExtraPaymentRequestMock: vi.fn(),
  getExtraPaymentAuditorsMock: vi.fn().mockResolvedValue({}),
  listPaymentInstallmentsMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: authState.id, role: authState.role },
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../../services/serviceExpenseService', () => ({
  listExtraPaymentRequests: listExtraPaymentRequestsMock,
  cancelExtraPaymentRequest: cancelExtraPaymentRequestMock,
  getExtraPaymentAuditors: getExtraPaymentAuditorsMock,
}));

vi.mock('../../services/paymentInstallmentService', () => ({
  listPaymentInstallments: listPaymentInstallmentsMock,
}));

vi.mock('../../lib/storageHelpers', () => ({
  getFinancialDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.example/url'),
}));

vi.mock('./ExtraPaymentFormModal', () => ({
  default: () => null,
}));

import ExtraPaymentsTab from './ExtraPaymentsTab';

import type { ExtraPaymentRequest } from '../../types/serviceExpense';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function baseRequest(overrides: Partial<ExtraPaymentRequest> = {}): ExtraPaymentRequest {
  return {
    id: 'epr-1',
    clientId: 'client-1',
    requestNumber: 'PE-2609-0001',
    category: 'outro',
    serviceDate: '2026-09-11',
    supplierName: 'Sidnei Paiva da Cruz',
    amount: 70,
    status: 'aprovado',
    createdById: 'creator-1',
    approvedBy: 'approver-1',
    createdAt: '2026-09-11T00:00:00Z',
    updatedAt: '2026-09-11T00:00:00Z',
    ...overrides,
  } as ExtraPaymentRequest;
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
        <ExtraPaymentsTab />
      </QueryClientProvider>,
    );
  });
  return root;
}

function openDetail() {
  const btn = container.querySelector('button[title="Visualizar"]') as HTMLButtonElement | null;
  if (!btn) throw new Error('Botão Visualizar não encontrado');
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function findButtonByText(text: string): HTMLButtonElement | null {
  return (Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined) ?? null;
}

function fillReason(value: string) {
  const textarea = container.querySelector('#cancel-payment-reason') as HTMLTextAreaElement | null;
  if (!textarea) throw new Error('Textarea cancel-payment-reason não encontrada');
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as ReactContainer;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  listExtraPaymentRequestsMock.mockReset();
  cancelExtraPaymentRequestMock.mockReset().mockResolvedValue(undefined);
  getExtraPaymentAuditorsMock.mockReset().mockResolvedValue({});
  listPaymentInstallmentsMock.mockReset().mockResolvedValue([]);
  authState.id = 'user-1';
  authState.role = 'Fleet Assistant';
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('ExtraPaymentsTab — cancelamento', () => {
  it('aprovador vê botão Cancelar pagamento no detalhe', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
  });

  it('outro aprovador não vê botão', async () => {
    authState.id = 'other-2';
    authState.role = 'Coordinator';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2609-0001');
    });
    expect(findButtonByText('Cancelar pagamento')).toBeNull();
  });

  it('Admin Master vê botão', async () => {
    authState.id = 'am-9';
    authState.role = 'Admin Master';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
  });

  it('aprovador com status pago não vê botão', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest({ status: 'pago' })]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(container.textContent).toContain('PE-2609-0001');
    });
    expect(findButtonByText('Cancelar pagamento')).toBeNull();
  });

  it('fluxo do aprovador chama cancel com motivo normalizado e status aprovado', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
    act(() => {
      findButtonByText('Cancelar pagamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(container.textContent).toContain('Cancelar pagamento extra');
      expect(container.textContent).toContain('Pedido PE-2609-0001');
    });
    fillReason('  Serviço não realizado  ');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar cancelamento')?.disabled).toBe(false);
    });
    act(() => {
      findButtonByText('Confirmar cancelamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(cancelExtraPaymentRequestMock).toHaveBeenCalledWith('epr-1', 'Serviço não realizado', 'aprovado');
    });
  });

  it('fluxo do criador pendente chama cancel com pendente_aprovacao', async () => {
    authState.id = 'creator-1';
    authState.role = 'Fleet Assistant';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest({ status: 'pendente_aprovacao', approvedBy: undefined })]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
    act(() => {
      findButtonByText('Cancelar pagamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(container.textContent).toContain('Cancelar pagamento extra');
    });
    fillReason('Lançado em duplicidade');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar cancelamento')?.disabled).toBe(false);
    });
    act(() => {
      findButtonByText('Confirmar cancelamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(cancelExtraPaymentRequestMock).toHaveBeenCalledWith('epr-1', 'Lançado em duplicidade', 'pendente_aprovacao');
    });
  });

  it('erro de parcela lançada exibe alerta e mantém botão', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest()]);
    cancelExtraPaymentRequestMock.mockRejectedValue(new Error('Não é possível cancelar: há parcela deste pagamento extra já lançada no sistema.'));
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
    act(() => {
      findButtonByText('Cancelar pagamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(container.textContent).toContain('Cancelar pagamento extra');
    });
    fillReason('Serviço não realizado');
    act(() => {
      findButtonByText('Confirmar cancelamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      const alert = container.querySelector('[role="alert"]');
      expect(alert?.textContent).toBe('Não é possível cancelar: há parcela deste pagamento extra já lançada no sistema.');
      expect(findButtonByText('Confirmar cancelamento')).not.toBeNull();
    });
  });

  it('criador pendente não tem botão de cancelar na linha', async () => {
    authState.id = 'creator-1';
    authState.role = 'Fleet Assistant';
    listExtraPaymentRequestsMock.mockResolvedValue([baseRequest({ status: 'pendente_aprovacao', approvedBy: undefined })]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[title="Visualizar"]')).not.toBeNull();
    });
    expect(container.querySelector('button[title="Cancelar"]')).toBeNull();
  });
});
