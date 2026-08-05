import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listInstallmentsMock, listApprovedOrdersMock } = vi.hoisted(() => ({
  listInstallmentsMock: vi.fn(),
  listApprovedOrdersMock: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'Financeiro' }, currentClient: { id: 'client-1' }, clients: [] }),
}));
vi.mock('../../services/paymentInstallmentService', () => ({
  listPaymentInstallments: listInstallmentsMock,
  listApprovedOrdersForPayment: listApprovedOrdersMock,
  markInstallmentsPaid: vi.fn(),
}));
vi.mock('../../lib/storageHelpers', () => ({
  getFinancialDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.example/doc.pdf'),
}));
vi.mock('../dashboard/ActionQueue', () => ({ default: () => null }));
vi.mock('./PaymentInstallmentEditModal', () => ({ default: () => null }));
vi.mock('./PaymentInstallmentFormModal', () => ({ default: () => null }));
vi.mock('./PaymentInstallmentViewModal', () => ({ default: () => null }));

import PaymentsTab from './PaymentsTab';

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
    status: 'aprovado',
    paymentMethod: 'boleto',
    boletoUrl: 'client-1/boleto.pdf',
    notaFiscalUrl: 'client-1/nota.pdf',
    notaFiscalUrl2: 'client-1/nota-2.pdf',
    invoiceNumber: 'NF-1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
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
        <PaymentsTab />
      </QueryClientProvider>,
    );
  });
  return root;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  listInstallmentsMock.mockReset();
  listApprovedOrdersMock.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('PaymentsTab', () => {
  it('mantém exportação CSV/XLSX para Financeiro/Admin Master', async () => {
    listInstallmentsMock.mockResolvedValue([installment()]);
    renderTab();

    await waitForAssertion(() => {
      const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
      expect(buttons.some((t) => t?.includes('Baixar CSV'))).toBe(true);
      expect(buttons.some((t) => t?.includes('Baixar XLSX'))).toBe(true);
    });
  });

  it('mantém o filtro de origem misto (Manutenção/Extras) no ledger único', async () => {
    listInstallmentsMock.mockResolvedValue([installment()]);
    renderTab();

    await waitForAssertion(() => {
      const options = Array.from(container.querySelectorAll('select option')).map((o) => o.textContent);
      expect(options).toContain('Manutenção');
      expect(options).toContain('Extras');
    });
  });

  it('controles de documento têm nomes acessíveis e não usam emojis', async () => {
    listInstallmentsMock.mockResolvedValue([installment()]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.querySelector('[aria-label="Orçamento"], [aria-label="Nota fiscal"]')).not.toBeNull();
    });

    const docControls = Array.from(container.querySelectorAll('[aria-label]')).filter((el) =>
      ['Orçamento', 'Boleto', 'Nota fiscal', 'Nota fiscal (2º documento)'].includes(el.getAttribute('aria-label') ?? ''),
    );
    expect(docControls.length).toBeGreaterThan(0);
    for (const el of docControls) {
      expect(el.getAttribute('title')).toBeTruthy();
    }
    expect(container.textContent).not.toMatch(/📄|📃|🔑|🧾/);
  });
});
