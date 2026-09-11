import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CANCELLATION_IRREVERSIBLE_WARNING } from '../../lib/paymentCancellation';

import CancelPaymentModal from './CancelPaymentModal';

import type { CancelPaymentModalProps } from './CancelPaymentModal';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

const defaultProps: CancelPaymentModalProps = {
  open: true,
  title: 'Cancelar parcela',
  entityLabel: 'Parcela 1/2 · OS-2609-0012',
  amount: 1234.56,
  submitting: false,
  error: null,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  vi.restoreAllMocks();
});

function render(overrides: Partial<CancelPaymentModalProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(<CancelPaymentModal {...props} />);
  });
  return root;
}

describe('CancelPaymentModal', () => {
  it('open: false renderiza nada', () => {
    render({ open: false });
    expect(container.textContent).toBe('');
  });

  it('dialog com aria-modal, aria-labelledby e título correto', () => {
    render();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-labelledby')).toBe('cancel-payment-title');
    const title = container.querySelector('#cancel-payment-title');
    expect(title?.textContent).toBe('Cancelar parcela');
  });

  it('exibe entityLabel e valor formatado com R$ e não-break space', () => {
    render();
    expect(container.textContent).toContain('Parcela 1/2 · OS-2609-0012');
    expect(container.textContent).toContain('R$\u00A01.234,56');
  });

  it('exibe o aviso de irreversibilidade', () => {
    render();
    expect(container.textContent).toContain(CANCELLATION_IRREVERSIBLE_WARNING);
  });

  it('botão Confirmar cancelamento começa desabilitado', () => {
    render();
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Confirmar cancelamento',
    );
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(true);
  });

  it('motivo só espaços mantém botão desabilitado', () => {
    render();
    const textarea = container.querySelector('#cancel-payment-reason') as HTMLTextAreaElement;
    act(() => {
      setTextareaValue(textarea, '   ');
    });
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Confirmar cancelamento',
    );
    expect(btn!.disabled).toBe(true);
  });

  it('motivo válido habilita botão e onConfirm é chamado com trim', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    const textarea = container.querySelector('#cancel-payment-reason') as HTMLTextAreaElement;
    act(() => {
      setTextareaValue(textarea, '  Parcela duplicada  ');
    });
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Confirmar cancelamento',
    );
    expect(btn!.disabled).toBe(false);
    act(() => {
      btn!.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Parcela duplicada');
  });

  it('motivo com 501 caracteres mantém botão desabilitado', () => {
    render();
    const textarea = container.querySelector('#cancel-payment-reason') as HTMLTextAreaElement;
    act(() => {
      setTextareaValue(textarea, 'a'.repeat(501));
    });
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Confirmar cancelamento',
    );
    expect(btn!.disabled).toBe(true);
  });

  it('submitting=true mostra Cancelando… e desabilita ambos os botões', () => {
    render({ submitting: true });
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancelando…',
    );
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn!.disabled).toBe(true);
    const voltarBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Voltar',
    );
    expect(voltarBtn).toBeDefined();
    expect(voltarBtn!.disabled).toBe(true);
  });

  it('error exibe alerta com a mensagem', () => {
    render({ error: 'Falha X' });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toBe('Falha X');
  });

  it('Voltar chama onClose e não chama onConfirm; label e maxLength corretos', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render({ onConfirm, onClose });
    const voltarBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Voltar',
    );
    act(() => {
      voltarBtn!.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(0);
    const label = container.querySelector('label[for="cancel-payment-reason"]');
    expect(label!.textContent).toContain('Motivo do cancelamento');
    const textarea = container.querySelector('#cancel-payment-reason') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
  });
});
