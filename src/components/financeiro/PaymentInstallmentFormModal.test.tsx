import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PaymentInstallmentFormModal from './PaymentInstallmentFormModal';

import type { ApprovedOrderForPayment } from '../../services/paymentInstallmentService';

const {
  useQueryMock,
  useQueryClientMock,
  listApprovedOrdersForPaymentMock,
  createPaymentInstallmentsBatchMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  listApprovedOrdersForPaymentMock: vi.fn(),
  createPaymentInstallmentsBatchMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useQueryClient: useQueryClientMock,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../../services/paymentInstallmentService', () => ({
  listApprovedOrdersForPayment: listApprovedOrdersForPaymentMock,
  createPaymentInstallmentsBatch: createPaymentInstallmentsBatchMock,
}));

vi.mock('../../lib/storageHelpers', () => ({
  openPrivateDocument: vi.fn(),
  uploadFinancialDocument: vi.fn(),
}));

vi.mock('../../lib/invoiceOcr', () => ({
  extractInvoiceNumber: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

const orders: ApprovedOrderForPayment[] = [
  {
    id: 'os-1',
    osNumber: 'OS-001',
    status: 'Concluído',
    approvedCost: 100,
    remainingBudget: 100,
    workshopName: 'Oficina A',
    vehiclePlate: 'ABC1D23',
    operationalUnitName: 'Unidade Norte',
    clientId: 'client-1',
  },
  {
    id: 'os-2',
    osNumber: 'OS-002',
    status: 'Concluído',
    approvedCost: 100,
    remainingBudget: 100,
    workshopName: 'Oficina B',
    vehiclePlate: 'XYZ9K88',
    operationalUnitName: undefined,
    clientId: 'client-1',
  },
];

let container: RootedDiv;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  useQueryClientMock.mockReturnValue({ invalidateQueries: vi.fn().mockResolvedValue(undefined) });
  listApprovedOrdersForPaymentMock.mockResolvedValue(orders);
  createPaymentInstallmentsBatchMock.mockReset().mockResolvedValue(undefined);
  useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
    if (options.queryKey[0] === 'approvedOrdersForPayment') {
      return { data: orders, isLoading: false, error: null };
    }
    return { data: [], isLoading: false, error: null };
  });
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
  vi.restoreAllMocks();
});

function renderModal() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(<PaymentInstallmentFormModal open onClose={() => {}} />);
  });
}

function selectOrder(orderId: string) {
  const combobox = container.querySelector('input[role="combobox"]') as HTMLInputElement;
  act(() => {
    combobox.click();
  });
  const option = Array.from(container.querySelectorAll('[role="option"]')).find((node) =>
    node.textContent?.includes(orderId === 'os-1' ? 'OS-001' : 'OS-002'),
  );
  act(() => {
    (option as HTMLElement).click();
  });
}

function setNativeValue(element: HTMLInputElement, value: string) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) Reflect.apply(setter, element, [value]);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function centerCostInput(): HTMLInputElement {
  return container.querySelector('input[name="financeiro-centro-custo"]') as HTMLInputElement;
}

function firstDueDateInput(): HTMLInputElement {
  return container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
}

describe('PaymentInstallmentFormModal', () => {
  it('selecionar os-1 preenche Centro de Custo com a unidade do veículo', () => {
    renderModal();

    selectOrder('os-1');

    expect(centerCostInput().value).toBe('Unidade Norte');
  });

  it('preserva edição manual de Centro de Custo no batch salvo', async () => {
    renderModal();
    selectOrder('os-1');

    act(() => {
      setNativeValue(centerCostInput(), 'Centro Manual');
      setNativeValue(firstDueDateInput(), '2026-08-01');
    });
    const generateButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Gerar parcelas'),
    );
    act(() => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.startsWith('Salvar'),
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createPaymentInstallmentsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        centroCusto: 'Centro Manual',
        drafts: [expect.objectContaining({ value: 100, dueDate: '2026-08-01' })],
      }),
    );
  });

  it('selecionar os-1 e depois os-2 sem unidade limpa Centro de Custo', () => {
    renderModal();

    selectOrder('os-1');
    expect(centerCostInput().value).toBe('Unidade Norte');

    selectOrder('os-2');

    expect(centerCostInput().value).toBe('');
  });
});
