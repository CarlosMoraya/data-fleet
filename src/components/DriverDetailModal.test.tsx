import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DriverDetailModal from './DriverDetailModal';

import type { Driver } from '../types/driver';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: ReactContainer;

const driver: Driver = {
  id: 'driver-1',
  clientId: 'client-1',
  active: true,
  name: 'Maria Silva',
  cpf: '12345678901',
};

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

function renderModal(props: Partial<React.ComponentProps<typeof DriverDetailModal>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <DriverDetailModal
        driver={driver}
        onClose={() => {}}
        {...props}
      />,
    );
  });
}

describe('DriverDetailModal', () => {
  it('exibe o botão Editar e chama o callback ao clicar', () => {
    const onEdit = vi.fn();
    renderModal({ onEdit });

    const editButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Editar'),
    );

    expect(editButton).not.toBeUndefined();

    act(() => {
      editButton?.click();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('não exibe o botão Editar sem onEdit', () => {
    renderModal();

    const editButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Editar'),
    );

    expect(editButton).toBeUndefined();
  });

  it('mantém o botão Fechar e chama onClose sem onEdit', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const closeButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Fechar'),
    );

    expect(closeButton).not.toBeUndefined();

    act(() => {
      closeButton?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
