import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXTRA_PAYMENT_INSTALLMENT_CANCEL_HINT } from '../../lib/paymentCancellation';

const { authState, listPaymentInstallmentsMock, listApprovedOrdersMock, markInstallmentsPaidMock, cancelPaymentInstallmentMock, getPaymentInstallmentAuditorsMock } = vi.hoisted(() => ({
  authState: { id: 'user-1', role: 'Fleet Assistant' as string },
  listPaymentInstallmentsMock: vi.fn(),
  listApprovedOrdersMock: vi.fn().mockResolvedValue([]),
  markInstallmentsPaidMock: vi.fn(),
  cancelPaymentInstallmentMock: vi.fn(),
  getPaymentInstallmentAuditorsMock: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: authState.id, role: authState.role },
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../../services/paymentInstallmentService', () => ({
  listPaymentInstallments: listPaymentInstallmentsMock,
  listApprovedOrdersForPayment: listApprovedOrdersMock,
  markInstallmentsPaid: markInstallmentsPaidMock,
  cancelPaymentInstallment: cancelPaymentInstallmentMock,
  getPaymentInstallmentAuditors: getPaymentInstallmentAuditorsMock,
}));

vi.mock('../../lib/storageHelpers', () => ({
  getFinancialDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.example/doc.pdf'),
  openPrivateDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./PaymentInstallmentEditModal', () => ({ default: () => null }));
vi.mock('./PaymentInstallmentFormModal', () => ({ default: () => null }));

import PaymentsTab from './PaymentsTab';

import type { PaymentInstallment } from '../../types/payment';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

function baseInstallment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'i1',
    maintenanceOrderId: 'os-1',
    maintenanceOrderOs: 'OS-2609-0012',
    sourceType: 'maintenance_order',
    clientId: 'client-1',
    installmentNumber: 1,
    installmentsTotal: 2,
    value: 500,
    dueDate: '2026-09-20',
    status: 'aprovado',
    paymentMethod: 'boleto',
    paymentApprovedBy: 'approver-1',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  } as PaymentInstallment;
}

async function waitForAssertion(assertion: () => void): Promise<void> {
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

function renderTab(): void {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <PaymentsTab />
      </QueryClientProvider>,
    );
  });
}

function openDetail(): void {
  const btn = container.querySelector('button[aria-label="Visualizar parcela"]') as HTMLButtonElement | null;
  if (!btn) throw new Error('Botão Visualizar parcela não encontrado');
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function findButtonByText(text: string): HTMLButtonElement | null {
  return (Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined) ?? null;
}

function fillReason(value: string): void {
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
  listPaymentInstallmentsMock.mockReset();
  listApprovedOrdersMock.mockReset().mockResolvedValue([]);
  markInstallmentsPaidMock.mockReset();
  cancelPaymentInstallmentMock.mockReset().mockResolvedValue(undefined);
  getPaymentInstallmentAuditorsMock.mockReset().mockResolvedValue({});
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

describe('PaymentsTab — cancelamento', () => {
  it('aprovador vê botão Cancelar pagamento no detalhe', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listPaymentInstallmentsMock.mockResolvedValue([baseInstallment()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[aria-label="Visualizar parcela"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
  });

  it('outro aprovador não vê botão', async () => {
    authState.id = 'other-2';
    authState.role = 'Coordinator';
    listPaymentInstallmentsMock.mockResolvedValue([baseInstallment()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[aria-label="Visualizar parcela"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(container.textContent).toContain('Parcela 1/2');
    });
    expect(findButtonByText('Cancelar pagamento')).toBeNull();
  });

  it('Admin Master vê botão', async () => {
    authState.id = 'am-9';
    authState.role = 'Admin Master';
    listPaymentInstallmentsMock.mockResolvedValue([baseInstallment()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[aria-label="Visualizar parcela"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
  });

  it('aprovador com status pago não vê botão', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listPaymentInstallmentsMock.mockResolvedValue([baseInstallment({ status: 'pago' })]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[aria-label="Visualizar parcela"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(container.textContent).toContain('Parcela 1/2');
    });
    expect(findButtonByText('Cancelar pagamento')).toBeNull();
  });

  it('parcela extra aprovada mostra dica e não mostra botão cancelar', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listPaymentInstallmentsMock.mockResolvedValue([
      baseInstallment({
        sourceType: 'extra_payment',
        maintenanceOrderId: undefined,
        extraPaymentRequestId: 'epr-1',
        extraPaymentApprovedBy: 'approver-1',
      }),
    ]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[aria-label="Visualizar parcela"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(container.textContent).toContain(EXTRA_PAYMENT_INSTALLMENT_CANCEL_HINT);
    });
    expect(findButtonByText('Cancelar pagamento')).toBeNull();
  });

  it('fluxo do aprovador chama cancel com motivo normalizado', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listPaymentInstallmentsMock.mockResolvedValue([baseInstallment()]);
    renderTab();
    await waitForAssertion(() => {
      expect(container.querySelector('button[aria-label="Visualizar parcela"]')).not.toBeNull();
    });
    openDetail();
    await waitForAssertion(() => {
      expect(findButtonByText('Cancelar pagamento')).not.toBeNull();
    });
    act(() => {
      findButtonByText('Cancelar pagamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(container.textContent).toContain('Cancelar parcela');
      expect(container.textContent).toContain('Parcela 1/2 · OS-2609-0012');
    });
    fillReason(' Parcela duplicada ');
    await waitForAssertion(() => {
      expect(findButtonByText('Confirmar cancelamento')?.disabled).toBe(false);
    });
    act(() => {
      findButtonByText('Confirmar cancelamento')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      expect(cancelPaymentInstallmentMock).toHaveBeenCalledWith('i1', 'Parcela duplicada');
    });
  });

  it('select de status tem opção Cancelado e linha cancelada mostra Cancelado', async () => {
    authState.id = 'approver-1';
    authState.role = 'Coordinator';
    listPaymentInstallmentsMock.mockResolvedValue([baseInstallment({ status: 'cancelado' })]);
    renderTab();
    await waitForAssertion(() => {
      const options = Array.from(container.querySelectorAll('select option')).map((o) => o.textContent?.trim());
      expect(options).toContain('Cancelado');
      expect(container.textContent).toContain('Cancelado');
    });
  });
});
