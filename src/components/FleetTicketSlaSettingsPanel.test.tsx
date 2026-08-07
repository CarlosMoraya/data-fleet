import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, saveMock } = vi.hoisted(() => ({ getMock: vi.fn(), saveMock: vi.fn() }));

vi.mock('../services/fleetTicketSlaSettingsService', () => ({
  getFleetTicketSlaSettings: getMock,
  saveFleetTicketSlaSettings: saveMock,
}));

import FleetTicketSlaSettingsPanel from './FleetTicketSlaSettingsPanel';

let container: HTMLDivElement;

const defaults = { clientId: 'client-1', openSlaHours: 24, assignedSlaHours: 72 };

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  getMock.mockResolvedValue(defaults);
  saveMock.mockImplementation(async (settings) => settings);
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderPanel() {
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(<QueryClientProvider client={queryClient}><FleetTicketSlaSettingsPanel clientId="client-1" userId="user-1" /></QueryClientProvider>);
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

function getSaveButton(): HTMLButtonElement {
  return Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Salvar configurações')) as HTMLButtonElement;
}

describe('FleetTicketSlaSettingsPanel', () => {
  it('renders the two fields with values coming from the service', async () => {
    const root = await renderPanel();
    const openInput = container.querySelector('#sla-open-hours') as HTMLInputElement;
    const assignedInput = container.querySelector('#sla-assigned-hours') as HTMLInputElement;
    expect(openInput.value).toBe('24');
    expect(assignedInput.value).toBe('72');
    act(() => root.unmount());
  });

  it('starts with the save button disabled', async () => {
    const root = await renderPanel();
    expect(getSaveButton().disabled).toBe(true);
    act(() => root.unmount());
  });

  it('enables the button after changing the open field', async () => {
    const root = await renderPanel();
    const openInput = container.querySelector('#sla-open-hours') as HTMLInputElement;
    setInputValue(openInput, '10');
    expect(getSaveButton().disabled).toBe(false);
    act(() => root.unmount());
  });

  it('keeps the button disabled when typing 0 (out of range)', async () => {
    const root = await renderPanel();
    const openInput = container.querySelector('#sla-open-hours') as HTMLInputElement;
    setInputValue(openInput, '0');
    expect(getSaveButton().disabled).toBe(true);
    act(() => root.unmount());
  });

  it('keeps the button disabled when typing 9000 (out of range)', async () => {
    const root = await renderPanel();
    const assignedInput = container.querySelector('#sla-assigned-hours') as HTMLInputElement;
    setInputValue(assignedInput, '9000');
    expect(getSaveButton().disabled).toBe(true);
    act(() => root.unmount());
  });

  it('saves successfully and shows the success message', async () => {
    const root = await renderPanel();
    const openInput = container.querySelector('#sla-open-hours') as HTMLInputElement;
    setInputValue(openInput, '10');
    saveMock.mockResolvedValue({ clientId: 'client-1', openSlaHours: 10, assignedSlaHours: 72, updatedBy: 'user-1' });
    act(() => getSaveButton().click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ openSlaHours: 10 }), 'user-1');
    expect(container.textContent).toContain('Configurações de SLA salvas com sucesso.');
    act(() => root.unmount());
  });
});
