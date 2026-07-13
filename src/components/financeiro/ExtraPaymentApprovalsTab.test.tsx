import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useQueryMock,
  useMutationMock,
  useQueryClientMock,
  listExtraPaymentRequestsMock,
  approveExtraPaymentRequestMock,
  rejectExtraPaymentRequestMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  listExtraPaymentRequestsMock: vi.fn(),
  approveExtraPaymentRequestMock: vi.fn(),
  rejectExtraPaymentRequestMock: vi.fn(),
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
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../../services/serviceExpenseService', () => ({
  approveExtraPaymentRequest: approveExtraPaymentRequestMock,
  listExtraPaymentRequests: listExtraPaymentRequestsMock,
  rejectExtraPaymentRequest: rejectExtraPaymentRequestMock,
}));

import ExtraPaymentApprovalsTab from './ExtraPaymentApprovalsTab';

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

let approveMutate: ReturnType<typeof vi.fn>;
let rejectMutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  useQueryClientMock.mockReturnValue({ invalidateQueries: vi.fn().mockResolvedValue(undefined) });
  approveMutate = vi.fn();
  rejectMutate = vi.fn();
  useMutationMock.mockImplementation((options: { mutationFn: (...args: unknown[]) => unknown }) => {
    const isReject = options.mutationFn.toString().includes('reason');
    return {
      mutate: isReject ? rejectMutate : approveMutate,
      isPending: false,
    };
  });
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
    root.render(<ExtraPaymentApprovalsTab />);
  });
}

describe('ExtraPaymentApprovalsTab', () => {
  it('lista pendentes', () => {
    renderTab([baseRequest()]);
    expect(container.textContent).toContain('PE-2607-0001');
    expect(container.textContent).toContain('Pagamentos extras aguardando aprovação');
  });

  it('aprovar chama service correto', () => {
    renderTab([baseRequest()]);
    const approveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Aprovar'),
    );
    act(() => {
      approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(approveMutate).toHaveBeenCalledWith('epr-1');
  });

  it('reprovar exige motivo', () => {
    renderTab([baseRequest()]);
    const rejectButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reprovar'),
    );
    act(() => {
      rejectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar reprovação'),
    );
    expect(confirmButton?.hasAttribute('disabled')).toBe(true);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(textarea, 'Documentação incompleta');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const confirmButtonAfter = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar reprovação'),
    );
    expect(confirmButtonAfter?.hasAttribute('disabled')).toBe(false);

    act(() => {
      confirmButtonAfter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(rejectMutate).toHaveBeenCalledWith({ id: 'epr-1', reason: 'Documentação incompleta' });
  });

  it('processados exibem aprovador/data', () => {
    renderTab([
      baseRequest({
        id: 'epr-2',
        status: 'aprovado',
        approvedByName: 'Coordenador Fulano',
        approvedAt: '2026-07-11T10:00:00Z',
      }),
    ]);
    expect(container.textContent).toContain('Coordenador Fulano');
    expect(container.textContent).toContain('Já processados');
  });
});
