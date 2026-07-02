import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConfirmDeleteModal from './ConfirmDeleteModal';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: ReactContainer;

beforeEach(() => {
  container = document.createElement('div') as ReactContainer;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderModal(props?: Partial<React.ComponentProps<typeof ConfirmDeleteModal>>) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <ConfirmDeleteModal
        open
        title="Excluir"
        description="Confirme a exclusão."
        confirmLabel="Excluir definitivamente"
        expectedText="ABC1D23"
        onConfirm={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );
  });
}

describe('ConfirmDeleteModal', () => {
  it('keeps the destructive button disabled until the expected text matches', () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    const input = container.querySelector('input') as HTMLInputElement | null;
    const confirmButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Excluir definitivamente'),
    );

    expect(input).not.toBeNull();
    expect(confirmButton?.getAttribute('disabled')).not.toBeNull();

    const setNativeValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;

    act(() => {
      setNativeValue?.call(input, 'ABC1D23');
      input?.dispatchEvent(new Event('change', { bubbles: true }));
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(confirmButton?.getAttribute('disabled')).toBeNull();
  });

  it('hides input and confirm button when blockedReason is present', () => {
    renderModal({ blockedReason: 'Bloqueado por vínculos.' });

    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('Bloqueado por vínculos.');
    expect(container.textContent).not.toContain('Excluir definitivamente');
  });
});
