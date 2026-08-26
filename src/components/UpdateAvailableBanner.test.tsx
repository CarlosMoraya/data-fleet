import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UpdateAvailableBanner from './UpdateAvailableBanner';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
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

function renderBanner(visible: boolean, onUpdate = vi.fn(), onDismiss = vi.fn()) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <UpdateAvailableBanner visible={visible} onUpdate={onUpdate} onDismiss={onDismiss} />,
    );
  });

  return { onUpdate, onDismiss };
}

describe('UpdateAvailableBanner', () => {
  it('não renderiza quando está invisível', () => {
    renderBanner(false);

    expect(container.innerHTML).toBe('');
  });

  it('renderiza o aviso e os dois botões quando está visível', () => {
    renderBanner(true);

    expect(container.textContent).toContain('Uma nova versão do BetaFleet está disponível.');
    expect(container.textContent).toContain('Atualizar agora');
    expect(container.textContent).toContain('Agora não');
  });

  it('chama onUpdate uma vez ao clicar em Atualizar agora', () => {
    const { onUpdate } = renderBanner(true);
    const button = container.querySelector('button[aria-label="Atualizar agora"]');

    act(() => {
      (button as HTMLButtonElement).click();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('chama onDismiss uma vez ao clicar em Agora não', () => {
    const { onDismiss } = renderBanner(true);
    const button = container.querySelector('button[aria-label="Agora não"]');

    act(() => {
      (button as HTMLButtonElement).click();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
