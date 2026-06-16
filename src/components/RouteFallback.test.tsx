import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import RouteFallback from './RouteFallback';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as any).__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as any).__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

describe('RouteFallback', () => {
  it('renders the route loading status', () => {
    renderWithAct(<RouteFallback />);

    const status = container.querySelector('[role="status"][aria-label="Carregando"]');

    expect(status).not.toBeNull();
  });

  it('keeps the existing spinner visual', () => {
    renderWithAct(<RouteFallback />);

    const spinner = container.querySelector('.animate-spin');

    expect(spinner).not.toBeNull();
  });
});
