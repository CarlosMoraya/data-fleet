import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, saveMock, testMock } = vi.hoisted(() => ({ getMock: vi.fn(), saveMock: vi.fn(), testMock: vi.fn() }));

vi.mock('../services/telegramSettingsService', () => ({
  getTelegramSettings: getMock,
  saveTelegramSettings: saveMock,
  sendTelegramTestMessage: testMock,
}));

import TelegramSettingsPanel from './TelegramSettingsPanel';

let container: HTMLDivElement;

const defaults = {
  clientId: 'client-1', enabled: false, chatId: '', notifySos: true, notifyCritical: true, notifyHigh: false,
};
const saved = { ...defaults, enabled: true, chatId: '-100123' };

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  getMock.mockResolvedValue(defaults);
  saveMock.mockImplementation(async (settings) => settings);
  testMock.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderPanel() {
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(<QueryClientProvider client={queryClient}><TelegramSettingsPanel clientId="client-1" userId="user-1" /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  return root;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('TelegramSettingsPanel', () => {
  it('renders defaults and disables test until settings are saved', async () => {
    const root = await renderPanel();
    expect(container.textContent).toContain('Ativar notificações Telegram');
    expect((container.querySelector('button:last-child') as HTMLButtonElement).disabled).toBe(true);
    act(() => root.unmount());
  });

  it('blocks enabled settings without chatId and saves valid settings', async () => {
    const root = await renderPanel();
    const enabled = container.querySelector('input[role="switch"]') as HTMLInputElement;
    act(() => { enabled.click(); });
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Salvar configurações')) as HTMLButtonElement;
    act(() => saveButton.click());
    await act(async () => { await Promise.resolve(); });
    expect(saveMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('chat_id');

    setInputValue(container.querySelector('input:not([role="switch"])') as HTMLInputElement, '-100123');
    saveMock.mockResolvedValue(saved);
    act(() => saveButton.click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, chatId: '-100123' }), 'user-1');
    act(() => root.unmount());
  });

  it('calls the test message and shows friendly errors', async () => {
    getMock.mockResolvedValue(saved);
    const root = await renderPanel();
    const testButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Enviar mensagem de teste')) as HTMLButtonElement;
    act(() => testButton.click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(testMock).toHaveBeenCalledWith('client-1');
    expect(container.textContent).toContain('Mensagem de teste enviada com sucesso.');

    testMock.mockRejectedValue(new Error('Telegram indisponível'));
    act(() => testButton.click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(container.textContent).toContain('Não foi possível enviar. Verifique se o bot foi adicionado ao grupo e se o chat_id está correto.');
    act(() => root.unmount());
  });
});
