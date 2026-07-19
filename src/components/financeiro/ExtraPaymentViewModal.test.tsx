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

function render(request: ExtraPaymentRequest) {
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(<ExtraPaymentViewModal open request={request} onClose={() => {}} />);
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
