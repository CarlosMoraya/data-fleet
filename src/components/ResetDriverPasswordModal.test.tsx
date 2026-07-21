import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resetDriverPasswordMock, fetchDriverPasswordResetHistoryMock } = vi.hoisted(() => ({
  resetDriverPasswordMock: vi.fn(),
  fetchDriverPasswordResetHistoryMock: vi.fn(),
}));

vi.mock('../services/driverService', () => ({
  resetDriverPassword: resetDriverPasswordMock,
  fetchDriverPasswordResetHistory: fetchDriverPasswordResetHistoryMock,
}));

import ResetDriverPasswordModal from './ResetDriverPasswordModal';

import type { Driver } from '../types';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: ReactContainer;

const baseDriver: Driver = {
  id: 'driver-1',
  clientId: 'client-1',
  active: true,
  profileId: 'profile-1',
  name: 'João da Silva',
  cpf: '12345678900',
} as Driver;

beforeEach(() => {
  container = document.createElement('div') as ReactContainer;
  document.body.appendChild(container);
  resetDriverPasswordMock.mockReset();
  fetchDriverPasswordResetHistoryMock.mockReset();
  fetchDriverPasswordResetHistoryMock.mockResolvedValue([]);
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

async function renderModal(props?: Partial<React.ComponentProps<typeof ResetDriverPasswordModal>>) {
  const root = createRoot(container);
  container.__reactRoot = root;

  await act(async () => {
    root.render(
      <ResetDriverPasswordModal
        open
        driver={baseDriver}
        onClose={() => {}}
        {...props}
      />,
    );
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setNativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setNativeValue?.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ResetDriverPasswordModal', () => {
  it('retorna null quando open é false', async () => {
    await renderModal({ open: false });
    expect(container.innerHTML).toBe('');
  });

  it('exibe nome e CPF formatado', async () => {
    await renderModal();
    expect(container.textContent).toContain('João da Silva');
    expect(container.textContent).toContain('123.456.789-00');
  });

  it('não renderiza nenhum email no estado inicial', async () => {
    await renderModal();
    expect(container.textContent).not.toMatch(/@/);
  });

  it('gera senha segura ao clicar no botão', async () => {
    await renderModal();
    const generateButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Gerar Senha Segura'),
    );

    act(() => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toMatch(/^BetaFleet-[A-Z2-9]{6}$/);
    expect(input.type).toBe('text');
  });

  it('alterna o type do input ao clicar no botão de olho', async () => {
    await renderModal();
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggleButton = container.querySelector('button[aria-label="Mostrar senha"]') as HTMLButtonElement;
    act(() => {
      toggleButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(input.type).toBe('text');
  });

  it('mantém Redefinir Senha desabilitado com senha curta', async () => {
    await renderModal();
    const input = container.querySelector('input') as HTMLInputElement;
    setInputValue(input, '1234');

    const submitButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Redefinir Senha'),
    );
    expect(submitButton?.getAttribute('disabled')).not.toBeNull();
  });

  it('exibe mensagem de sucesso e email retornado', async () => {
    resetDriverPasswordMock.mockResolvedValue({ success: true, email: 'motorista.123@x.com' });
    await renderModal();

    const input = container.querySelector('input') as HTMLInputElement;
    setInputValue(input, 'BetaFleet-K7M4XP');

    const submitButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Redefinir Senha'),
    ) as HTMLButtonElement;

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Senha redefinida com sucesso');
    expect(container.textContent).toContain('motorista.123@x.com');
  });

  it('exibe mensagem de erro e mantém botão ativo', async () => {
    resetDriverPasswordMock.mockRejectedValue(new Error('Falha ao redefinir.'));
    await renderModal();

    const input = container.querySelector('input') as HTMLInputElement;
    setInputValue(input, 'BetaFleet-K7M4XP');

    const submitButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Redefinir Senha'),
    ) as HTMLButtonElement;

    await act(async () => {
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Falha ao redefinir.');
    const submitButtonAfter = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Redefinir Senha'),
    );
    expect(submitButtonAfter?.getAttribute('disabled')).toBeNull();
  });

  it('limpa o campo de senha ao reabrir com outro driver', async () => {
    await renderModal();
    const input = container.querySelector('input') as HTMLInputElement;
    setInputValue(input, 'BetaFleet-K7M4XP');
    expect(input.value).toBe('BetaFleet-K7M4XP');

    const otherDriver: Driver = { ...baseDriver, id: 'driver-2', profileId: 'profile-2', name: 'Maria Souza' };
    await renderModal({ driver: otherDriver });

    const inputAfter = container.querySelector('input') as HTMLInputElement;
    expect(inputAfter.value).toBe('');
  });
});
