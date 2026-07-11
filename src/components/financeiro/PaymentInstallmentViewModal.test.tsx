import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/paymentInstallmentService', () => ({
  getPaymentInstallmentAuditors: vi.fn().mockResolvedValue({
    budgetApprovedByName: 'Ana Gestora',
    paymentApprovedByName: 'Bruno Coord',
    paidByName: 'Carla Financeiro',
  }),
}));

import PaymentInstallmentViewModal from './PaymentInstallmentViewModal';

import type { PaymentInstallment } from '../../types/payment';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
});

function makeInstallment(overrides: Partial<PaymentInstallment> = {}): PaymentInstallment {
  return {
    id: 'i1',
    maintenanceOrderId: 'mo-1',
    clientId: 'c1',
    installmentNumber: 1,
    installmentsTotal: 2,
    value: 1234.56,
    dueDate: '2026-07-10',
    status: 'pendente_aprovacao',
    paymentMethod: 'boleto',
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    invoiceNumber: 'NF-123',
    ...overrides,
  };
}

async function render(ui: React.ReactElement): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const root = createRoot(container);
  container.__reactRoot = root;
  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  });
  await flushAuditorsQuery();
}

async function flushAuditorsQuery(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe('PaymentInstallmentViewModal', () => {
  it('renderiza NF/Fatura, valor formatado e status', async () => {
    await render(<PaymentInstallmentViewModal open installment={makeInstallment()} onClose={() => {}} />);

    expect(container.textContent).toContain('NF-123');
    expect(container.textContent).toContain('R$');
    expect(container.textContent).toContain('1.234,56');
    expect(container.textContent).toContain('Pendente de aprovação');
  });

  it('mostra beneficiário quando pagamento é pix', async () => {
    await render(
      <PaymentInstallmentViewModal
        open
        installment={makeInstallment({
          paymentMethod: 'pix',
          pixBeneficiaryName: 'Fornecedor Pix',
        })}
        onClose={() => {}}
      />,
    );

    expect(container.textContent).toContain('Fornecedor Pix');
  });

  it('retorna null quando open=false', async () => {
    await render(<PaymentInstallmentViewModal open={false} installment={makeInstallment()} onClose={() => {}} />);

    expect(container.textContent).toBe('');
  });

  it('exibe os nomes de auditoria resolvidos pela RPC', async () => {
    await render(<PaymentInstallmentViewModal open installment={makeInstallment()} onClose={() => {}} />);

    expect(container.textContent).toContain('Ana Gestora');
    expect(container.textContent).toContain('Bruno Coord');
    expect(container.textContent).toContain('Carla Financeiro');
  });

  it('não vaza UUID cru dos campos de auditoria', async () => {
    await render(
      <PaymentInstallmentViewModal
        open
        installment={makeInstallment({ paymentApprovedBy: 'b22f6b92-1111-2222-3333-444455556666' })}
        onClose={() => {}}
      />,
    );

    expect(container.textContent).not.toContain('b22f6b92');
  });
});
