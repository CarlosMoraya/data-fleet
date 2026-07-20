import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, selectMock, eqMock, maybeSingleMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import ChecklistDayIntervalSettings from './ChecklistDayIntervalSettings';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;
let queryClient: QueryClient;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  maybeSingleMock.mockResolvedValue({ data: null, error: null });
  eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  selectMock.mockReturnValue({ eq: eqMock });
  upsertMock.mockResolvedValue({ error: null });
  fromMock.mockReturnValue({ select: selectMock, upsert: upsertMock });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderSettings() {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ChecklistDayIntervalSettings clientId="client-1" userId="user-1" />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitForAssertion(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError;
}

describe('ChecklistDayIntervalSettings — enforce_driver_vehicle_link', () => {
  it('com o checkbox marcado, o payload de upsert contém enforce_driver_vehicle_link: true', async () => {
    await renderSettings();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Exigir que o motorista use o veículo vinculado a ele');
    });

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    act(() => {
      checkbox.click();
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Salvar'));
    expect(saveButton).not.toBeUndefined();

    act(() => {
      saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(upsertMock).toHaveBeenCalled();
    });

    const payload = upsertMock.mock.calls[0][0];
    expect(payload.enforce_driver_vehicle_link).toBe(true);
  });

  it('com o checkbox desmarcado, o payload de upsert contém enforce_driver_vehicle_link: false (nunca null/undefined)', async () => {
    await renderSettings();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Exigir que o motorista use o veículo vinculado a ele');
    });

    const pneusInput = Array.from(container.querySelectorAll('input[type="number"]'))[2] as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(pneusInput, '10');
      pneusInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Salvar'));
    expect(saveButton).not.toBeUndefined();

    act(() => {
      saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(upsertMock).toHaveBeenCalled();
    });

    const payload = upsertMock.mock.calls[0][0];
    expect(payload.enforce_driver_vehicle_link).toBe(false);
  });
});
