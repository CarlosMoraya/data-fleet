import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

function render(ui: React.ReactElement): void {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

describe('PaymentInstallmentViewModal', () => {
  it('renderiza NF/Fatura, valor formatado e status', () => {
    render(<PaymentInstallmentViewModal open installment={makeInstallment()} onClose={() => {}} />);

    expect(container.textContent).toContain('NF-123');
    expect(container.textContent).toContain('R$');
    expect(container.textContent).toContain('1.234,56');
    expect(container.textContent).toContain('Pendente de aprovação');
  });

  it('mostra beneficiário quando pagamento é pix', () => {
    render(
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

  it('retorna null quando open=false', () => {
    render(<PaymentInstallmentViewModal open={false} installment={makeInstallment()} onClose={() => {}} />);

    expect(container.textContent).toBe('');
  });
});
