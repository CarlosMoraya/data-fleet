import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

vi.mock('../../lib/storageHelpers', () => ({
  getFinancialDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.example/url'),
}));

vi.mock('../../services/paymentInstallmentService', () => ({
  listPaymentInstallments: vi.fn(),
}));

vi.mock('../../services/serviceExpenseService', () => ({
  getExtraPaymentAuditors: vi.fn(),
}));

import ExtraPaymentViewModal from './ExtraPaymentViewModal';

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
  useQueryMock.mockReturnValue({ data: undefined });
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

function render(request: ExtraPaymentRequest, props: Partial<{ onRequestCancel: () => void }> = {}) {
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(<ExtraPaymentViewModal open request={request} onClose={() => {}} {...props} />);
  });
  return root;
}

describe('ExtraPaymentViewModal — evidências', () => {
  it('com evidenceUrls de 2 caminhos, exibe "Foto 1" e "Foto 2"', () => {
    render(baseRequest({ evidenceUrls: ['a/b.jpg', 'c/d.jpg'] }));
    expect(container.textContent).toContain('Foto 1');
    expect(container.textContent).toContain('Foto 2');
  });

  it('sem evidenceUrls, exibe "Nenhuma evidência anexada."', () => {
    render(baseRequest());
    expect(container.textContent).toContain('Nenhuma evidência anexada.');
  });

  it('com evidenceUrls vazio, também exibe a mensagem de vazio', () => {
    render(baseRequest({ evidenceUrls: [] }));
    expect(container.textContent).toContain('Nenhuma evidência anexada.');
  });
});

describe('ExtraPaymentViewModal — cancelamento', () => {
  it('com onRequestCancel exibe botão e chama ao clicar', () => {
    const spy = vi.fn();
    render(baseRequest(), { onRequestCancel: spy });
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancelar pagamento');
    expect(btn).toBeTruthy();
    act(() => {
      btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('sem onRequestCancel não exibe botão', () => {
    render(baseRequest());
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancelar pagamento');
    expect(btn).toBeFalsy();
  });

  it('status cancelado exibe motivo do cancelamento', () => {
    render(baseRequest({ status: 'cancelado', cancellationReason: 'Serviço não realizado' }));
    expect(container.textContent).toContain('Motivo do cancelamento');
    expect(container.textContent).toContain('Serviço não realizado');
  });

  it('exibe Cancelado por com nome do auditor', () => {
    useQueryMock.mockImplementation((opts: { queryKey: unknown[] }) => (opts.queryKey[0] === 'extraPaymentAuditors' ? { data: { cancelledByName: 'Bruno Coord' } } : { data: [] }));
    render(baseRequest());
    expect(container.textContent).toContain('Cancelado por');
    expect(container.textContent).toContain('Bruno Coord');
  });
});
