import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChunkErrorBoundary from './ChunkErrorBoundary';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;
let reloadSpy: ReturnType<typeof vi.fn>;

const ORIGINAL_LOCATION = Object.getOwnPropertyDescriptor(window, 'location');

function ThrowingChild({ message }: { message: string }): never {
  throw new Error(message);
}

function renderThrowingChild(message: string) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <ChunkErrorBoundary>
        <ThrowingChild message={message} />
      </ChunkErrorBoundary>,
    );
  });
}

beforeEach(() => {
  reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, reload: reloadSpy },
  });
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  sessionStorage.clear();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  if (ORIGINAL_LOCATION) Object.defineProperty(window, 'location', ORIGINAL_LOCATION);
  vi.restoreAllMocks();
});

describe('ChunkErrorBoundary', () => {
  it('registra falhas de chunk no console', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderThrowingChild('Failed to fetch dynamically imported module');

    expect(errorSpy).toHaveBeenCalledWith(
      '[ChunkErrorBoundary]',
      'Error',
      'Failed to fetch dynamically imported module',
      expect.any(String),
    );
  });

  it('registra erros de renderização que não são de chunk', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderThrowingChild('Cannot read properties of undefined');

    expect(errorSpy).toHaveBeenCalledWith(
      '[ChunkErrorBoundary]',
      'Error',
      'Cannot read properties of undefined',
      expect.any(String),
    );
  });

  it('não recarrega novamente quando a flag já existe e renderiza o fallback', () => {
    sessionStorage.setItem('chunk-reload-attempted', 'true');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderThrowingChild('Failed to fetch dynamically imported module');

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      'Não foi possível carregar esta parte do aplicativo. Atualize a página.',
    );
  });

  it('grava a flag e recarrega uma vez quando ainda não houve tentativa', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderThrowingChild('Failed to fetch dynamically imported module');

    expect(sessionStorage.getItem('chunk-reload-attempted')).toBe('true');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
