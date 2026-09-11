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
  cancelPaymentInstallment: vi.fn(),
}));
vi.mock('../../lib/storageHelpers', () => ({
  getFinancialDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.example/doc.pdf'),
}));
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
  it('oferece apenas exportação XLSX (CSV removido)', async () => {
    listInstallmentsMock.mockResolvedValue([installment()]);
    renderTab();

    await waitForAssertion(() => {
      const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
      expect(buttons.some((t) => t?.includes('Baixar XLSX'))).toBe(true);
      expect(buttons.some((t) => t?.includes('Baixar CSV'))).toBe(false);
    });
  });

  it('não renderiza mais o card de Pendências de pagamento', async () => {
    listInstallmentsMock.mockResolvedValue([installment({
      status: 'pendente_aprovacao',
      paymentMethod: 'boleto',
      boletoUrl: undefined,
    })]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.textContent).not.toContain('Pendências de pagamento');
      expect(container.textContent).not.toContain('Parcelas sem dados de pagamento');
    });
  });

  it('não oferece mais os filtros de forma de pagamento e de cliente', async () => {
    listInstallmentsMock.mockResolvedValue([installment()]);
    renderTab();

    await waitForAssertion(() => {
      const options = Array.from(container.querySelectorAll('select option')).map((o) => o.textContent);
      expect(options).not.toContain('Todas as formas');
      expect(options).not.toContain('Boleto');
      expect(options).not.toContain('Pix');
      expect(options).not.toContain('Todos os clientes');
    });
  });

  it('exibe a coluna Placa com a placa da OS de manutenção', async () => {
    listInstallmentsMock.mockResolvedValue([
      installment({ maintenanceOrderVehiclePlate: 'ABC1D23' }),
    ]);
    renderTab();

    await waitForAssertion(() => {
      const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent);
      expect(headers).toContain('Placa');
      expect(container.querySelector('tbody')?.textContent).toContain('ABC1D23');
    });
  });

  it('exibe a placa de parcelas de origem extra', async () => {
    listInstallmentsMock.mockResolvedValue([installment({
      sourceType: 'extra_payment',
      maintenanceOrderId: undefined,
      extraPaymentVehiclePlate: 'XYZ9K88',
    })]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.querySelector('tbody')?.textContent).toContain('XYZ9K88');
    });
  });

  it('filtra a tabela por placa', async () => {
    listInstallmentsMock.mockResolvedValue([
      installment({ id: 'i1', maintenanceOrderVehiclePlate: 'ABC1D23' }),
      installment({ id: 'i2', maintenanceOrderVehiclePlate: 'XYZ9K88' }),
    ]);
    renderTab();

    await waitForAssertion(() => {
      expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    const input = container.querySelector('[aria-label="Filtrar por placa"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Filtro de placa não encontrado');
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ) as { set?: (this: HTMLInputElement, value: string) => void } | undefined;
    act(() => {
      valueDescriptor?.set?.call(input, 'abc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await waitForAssertion(() => {
      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('ABC1D23');
      expect(rows[0].textContent).not.toContain('XYZ9K88');
    });
  });

  it('mostra travessão quando a parcela não tem placa', async () => {
    listInstallmentsMock.mockResolvedValue([installment()]);
    renderTab();

    await waitForAssertion(() => {
      const cells = container.querySelectorAll('tbody tr td');
      expect(cells[2]?.textContent).toBe('—');
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

  it('sinaliza na coluna Status que a OS de origem foi cancelada', async () => {
    listInstallmentsMock.mockResolvedValue([installment({ status: 'aprovado', maintenanceOrderStatus: 'Cancelado' })]);
    listApprovedOrdersMock.mockResolvedValue([]);
    renderTab();

    await waitForAssertion(() => {
      const row = container.querySelector('tbody tr');
      expect(row?.textContent).toContain('Aprovado');
      expect(row?.textContent).toContain('OS cancelada');
      const badge = Array.from(container.querySelectorAll('span')).find((el) => el.textContent === 'OS cancelada');
      expect(badge?.className).toContain('border-red-300');
    });
  });

  it('sinaliza serviço não concluído quando a OS ainda está em execução', async () => {
    listInstallmentsMock.mockResolvedValue([
      installment({ status: 'pendente_aprovacao', maintenanceOrderStatus: 'Orçamento aprovado' }),
    ]);
    listApprovedOrdersMock.mockResolvedValue([]);
    renderTab();

    await waitForAssertion(() => {
      const row = container.querySelector('tbody tr');
      expect(row?.textContent).toContain('Pendente de aprovação');
      expect(row?.textContent).toContain('Serviço não concluído');
      const badge = Array.from(container.querySelectorAll('span')).find(
        (el) => el.textContent === 'Serviço não concluído',
      );
      expect(badge?.className).toContain('border-amber-300');
    });
  });

  it('não sinaliza OS concluída', async () => {
    listInstallmentsMock.mockResolvedValue([installment({ status: 'aprovado', maintenanceOrderStatus: 'Veículo retirado' })]);
    listApprovedOrdersMock.mockResolvedValue([]);
    renderTab();

    await waitForAssertion(() => {
      const row = container.querySelector('tbody tr');
      expect(row?.textContent).toContain('Aprovado');
      expect(row?.textContent).not.toContain('OS cancelada');
      expect(row?.textContent).not.toContain('Serviço não concluído');
    });
  });

  it('não sinaliza parcela de Pagamento Extra', async () => {
    listInstallmentsMock.mockResolvedValue([
      installment({
        sourceType: 'extra_payment',
        maintenanceOrderId: undefined,
        status: 'aprovado',
        maintenanceOrderStatus: 'Cancelado',
      }),
    ]);
    listApprovedOrdersMock.mockResolvedValue([]);
    renderTab();

    await waitForAssertion(() => {
      const row = container.querySelector('tbody tr');
      expect(row?.textContent).toContain('Extra');
      expect(row?.textContent).not.toContain('OS cancelada');
    });
  });
});
