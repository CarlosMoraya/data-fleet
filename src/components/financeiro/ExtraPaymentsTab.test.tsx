import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useQueryMock, useMutationMock, useQueryClientMock, listExtraPaymentRequestsMock, authState } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  listExtraPaymentRequestsMock: vi.fn(),
  authState: { role: 'Fleet Assistant' as string },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: useQueryMock,
    useMutation: useMutationMock,
    useQueryClient: useQueryClientMock,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: authState.role },
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../../services/serviceExpenseService', () => ({
  cancelExtraPaymentRequest: vi.fn(),
  listExtraPaymentRequests: listExtraPaymentRequestsMock,
}));

vi.mock('./ExtraPaymentFormModal', () => ({
  default: () => null,
}));

vi.mock('./ExtraPaymentViewModal', () => ({
  default: () => null,
}));

import ExtraPaymentsTab from './ExtraPaymentsTab';

import type { ExtraPaymentRequest } from '../../types/serviceExpense';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

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

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  authState.role = 'Fleet Assistant';
  useQueryClientMock.mockReturnValue({ invalidateQueries: vi.fn().mockResolvedValue(undefined) });
  useMutationMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  listExtraPaymentRequestsMock.mockReset();
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

function renderTab(requests: ExtraPaymentRequest[]) {
  useQueryMock.mockReturnValue({ data: requests, isLoading: false });
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(<ExtraPaymentsTab />);
  });
}

describe('ExtraPaymentsTab', () => {
  it('renderiza vazio', () => {
    renderTab([]);
    expect(container.textContent).toContain('Nenhum pagamento extra encontrado.');
  });

  it('filtra por fornecedor/placa/motorista', () => {
    renderTab([
      baseRequest({ id: '1', supplierName: 'Guincho Rápido LTDA' }),
      baseRequest({ id: '2', supplierName: 'Borracharia do Zé', category: 'borracheiro' }),
    ]);

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(searchInput, 'borracharia');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('Borracharia do Zé');
    expect(container.textContent).not.toContain('Guincho Rápido LTDA');
  });

  it('mostra botão de criação para Fleet Assistant', () => {
    renderTab([]);
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons.some((t) => t?.includes('Novo Pagamento Extra'))).toBe(true);
  });

  it('não mostra botão de criação para Financeiro', () => {
    authState.role = 'Financeiro';
    renderTab([]);
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons.some((t) => t?.includes('Novo Pagamento Extra'))).toBe(false);
  });
});
