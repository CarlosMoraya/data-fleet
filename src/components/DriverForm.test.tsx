import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    currentClient: null,
  }),
}));

import DriverForm from './DriverForm';

import type { Driver } from '../types/driver';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

function baseProps(driver: Driver | null = null) {
  return {
    driver,
    fieldSettings: null,
    clientId: 'client-1',
    onClose: () => {},
    onSave: async () => {},
  };
}

describe('DriverForm', () => {
  it('exibe o upload do contrato ao selecionar PJ', () => {
    renderWithAct(<DriverForm {...baseProps()} />);

    const regime = container.querySelector('#employment-regime');
    expect(regime).toBeInstanceOf(HTMLSelectElement);

    act(() => {
      if (!(regime instanceof HTMLSelectElement)) throw new Error('Regime não encontrado');
      regime.value = 'PJ';
      regime.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(6);
  });

  it('não exibe o upload do contrato com regime CLT', () => {
    renderWithAct(<DriverForm {...baseProps({
      id: 'driver-1',
      clientId: 'client-1',
      active: true,
      name: 'Maria Silva',
      cpf: '12345678901',
      employmentRegime: 'CLT',
    })} />);

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(5);
  });

  it('não exibe o upload do contrato sem interação', () => {
    renderWithAct(<DriverForm {...baseProps()} />);

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(5);
  });

  it('exibe o link do contrato existente para PJ', () => {
    renderWithAct(<DriverForm {...baseProps({
      id: 'driver-1',
      clientId: 'client-1',
      active: true,
      name: 'Maria Silva',
      cpf: '12345678901',
      employmentRegime: 'PJ',
      serviceContractUpload: 'https://x/contrato.pdf',
    })} />);

    expect(container.querySelector('a[href="https://x/contrato.pdf"]')).not.toBeNull();
    expect(container.textContent).toContain('Visualizar');
  });

  it('associa o label do regime ao select', () => {
    renderWithAct(<DriverForm {...baseProps()} />);

    const label = container.querySelector('label[for="employment-regime"]');
    const select = container.querySelector('select#employment-regime');

    expect(label).not.toBeNull();
    expect(select).not.toBeNull();
  });
});
