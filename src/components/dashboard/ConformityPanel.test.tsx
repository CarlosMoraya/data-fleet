import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ConformityPanel from './ConformityPanel';

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

describe('ConformityPanel — empty state', () => {
  it('renders the title and message', () => {
    renderWithAct(<ConformityPanel />);

    const text = container.textContent ?? '';

    expect(text).toContain('Conformidade');
    expect(text).toContain('Em breve: indicadores de documentos');
  });

  it('does not render any button', () => {
    renderWithAct(<ConformityPanel />);

    expect(container.querySelectorAll('button').length).toBe(0);
  });
});