import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FinancialApprovalConfirmModal from './FinancialApprovalConfirmModal';

let container: HTMLDivElement;

function baseProps(overrides: Partial<React.ComponentProps<typeof FinancialApprovalConfirmModal>> = {}) {
  return {
    open: true,
    title: 'Aprovar parcelas',
    entityLabel: 'OS OS-0001',
    installmentCount: 3,
    totalValue: 1500,
    confirmLabel: 'Confirmar aprovação',
    submitting: false,
    error: null,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

describe('FinancialApprovalConfirmModal', () => {
  it('exibe título, entidade, quantidade de parcelas e total formatado em BRL', () => {
    const root = createRoot(container);
    act(() => {
      root.render(<FinancialApprovalConfirmModal {...baseProps()} />);
    });

    expect(container.textContent).toContain('Aprovar parcelas');
    expect(container.textContent).toContain('OS OS-0001');
    expect(container.textContent).toContain('3 parcela(s)');
    expect(container.textContent).toMatch(/R\$\s*1\.500,00/);
    act(() => root.unmount());
  });

  it('não fecha ao clicar no backdrop durante submitting, mas fecha quando não está enviando', () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    act(() => {
      root.render(<FinancialApprovalConfirmModal {...baseProps({ submitting: true, onClose })} />);
    });

    const backdrop = container.firstElementChild as HTMLElement;
    act(() => { backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      root.render(<FinancialApprovalConfirmModal {...baseProps({ submitting: false, onClose })} />);
    });
    act(() => { backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('Escape só fecha quando não está enviando', () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    act(() => {
      root.render(<FinancialApprovalConfirmModal {...baseProps({ submitting: true, onClose })} />);
    });

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      root.render(<FinancialApprovalConfirmModal {...baseProps({ submitting: false, onClose })} />);
    });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('exibe erro e spinner durante o envio, com os botões desabilitados', () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <FinancialApprovalConfirmModal
          {...baseProps({ submitting: true, error: 'Este pedido foi alterado.' })}
        />,
      );
    });

    expect(container.textContent).toContain('Este pedido foi alterado.');
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    act(() => root.unmount());
  });
});
