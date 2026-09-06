import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FLEET_TICKET_CRITICALITY_DESCRIPTIONS,
  FLEET_TICKET_CRITICALITY_ORDER,
  fleetTicketCriticalityLabel,
} from '../lib/fleetTicketRules';

import NewFleetTicketGuardModal from './NewFleetTicketGuardModal';

let container: HTMLDivElement;

interface RenderedProps {
  open: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

function renderModal(props: RenderedProps) {
  const root = createRoot(container);
  act(() => {
    root.render(<NewFleetTicketGuardModal open={props.open} onProceed={props.onProceed} onCancel={props.onCancel} />);
  });
  return {
    root,
    rerender: (next: RenderedProps) => {
      act(() => {
        root.render(<NewFleetTicketGuardModal open={next.open} onProceed={next.onProceed} onCancel={next.onCancel} />);
      });
    },
  };
}

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label);
  if (!button) throw new Error(`Botão não encontrado: ${label}`);
  return button;
}

function clickButton(label: string) {
  act(() => {
    findButton(label).click();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

describe('NewFleetTicketGuardModal', () => {
  it('não renderiza nada quando open é false', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: false, onProceed, onCancel });
    expect(container.textContent ?? '').toBe('');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    act(() => root.unmount());
  });

  it('renderiza o aviso de duplicidade como primeiro passo', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    expect(container.textContent).toContain('Passo 1 de 2');
    expect(container.textContent).toContain('Antes de abrir um chamado');
    expect(container.textContent).toContain('Tem certeza que o problema que você vai relatar já não foi informado por meio de um checklist realizado pelo motorista desse veículo?');
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    const heading = dialog.querySelector('h2')!;
    expect(heading.id).toBe(labelledBy);
    act(() => root.unmount());
  });

  it('o primeiro passo não exibe o guia de classificação', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    expect(container.textContent).not.toContain('Abra o chamado seguindo o guia de classificação abaixo:');
    act(() => root.unmount());
  });

  it('Cancelar no passo 1 chama onCancel e não chama onProceed', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    clickButton('Cancelar');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onProceed).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('Prosseguir no passo 1 avança para o guia sem concluir o fluxo', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    clickButton('Prosseguir');
    expect(container.textContent).toContain('Passo 2 de 2');
    expect(container.textContent).toContain('Abra o chamado seguindo o guia de classificação abaixo:');
    expect(onProceed).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('o guia exibe as quatro criticidades na ordem do domínio', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    clickButton('Prosseguir');
    const listItems = Array.from(container.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(listItems).toHaveLength(FLEET_TICKET_CRITICALITY_ORDER.length);
    FLEET_TICKET_CRITICALITY_ORDER.forEach((criticality, index) => {
      expect(listItems[index]).toContain(fleetTicketCriticalityLabel(criticality));
      expect(listItems[index]).toContain(FLEET_TICKET_CRITICALITY_DESCRIPTIONS[criticality]);
    });
    expect(container.textContent).not.toContain('Não classificado');
    act(() => root.unmount());
  });

  it('Cancelar no passo 2 chama onCancel e não volta ao passo 1', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    clickButton('Prosseguir');
    clickButton('Cancelar');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onProceed).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Passo 1 de 2');
    act(() => root.unmount());
  });

  it('Prosseguir no passo 2 chama onProceed exatamente uma vez', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const { root } = renderModal({ open: true, onProceed, onCancel });
    clickButton('Prosseguir');
    clickButton('Prosseguir');
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('Escape chama onCancel em qualquer passo', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const first = renderModal({ open: true, onProceed, onCancel });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => first.root.unmount());

    const onProceed2 = vi.fn<() => void>();
    const onCancel2 = vi.fn<() => void>();
    const second = renderModal({ open: true, onProceed: onProceed2, onCancel: onCancel2 });
    clickButton('Prosseguir');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel2).toHaveBeenCalledTimes(1);
    expect(onProceed2).not.toHaveBeenCalled();
    act(() => second.root.unmount());
  });

  it('reabrir o fluxo volta ao passo 1', () => {
    const onProceed = vi.fn<() => void>();
    const onCancel = vi.fn<() => void>();
    const props = { open: true, onProceed, onCancel };
    const { root, rerender } = renderModal(props);
    clickButton('Prosseguir');
    expect(container.textContent).toContain('Passo 2 de 2');
    rerender({ ...props, open: false });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    rerender({ ...props, open: true });
    expect(container.textContent).toContain('Passo 1 de 2');
    expect(container.textContent).not.toContain('Passo 2 de 2');
    expect(container.textContent).not.toContain('Abra o chamado seguindo o guia de classificação abaixo:');
    expect(onProceed).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
