import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import TruncatedText from './TruncatedText';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;

function renderTruncatedText(text: string, maxLength: number, className?: string) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => root.render(<TruncatedText text={text} maxLength={maxLength} className={className} />));
  return root;
}

function getButton(): HTMLButtonElement {
  const button = container.querySelector('button');
  if (!(button instanceof HTMLButtonElement)) throw new Error('Botão não encontrado');
  return button;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  document.body.removeChild(container);
});

describe('TruncatedText', () => {
  it('renderiza o texto completo como span quando cabe no maxLength', () => {
    renderTruncatedText('NF12345678', 10);

    expect(container.textContent).toBe('NF12345678');
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('trunca o texto com reticências e expõe o texto completo em atributos', () => {
    renderTruncatedText('NF123456789012', 10);
    const button = getButton();

    expect(button.textContent).toBe('NF12345678…');
    expect(button.getAttribute('title')).toBe('NF123456789012');
    expect(button.getAttribute('aria-label')).toBe('NF123456789012');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('expande o texto ao clicar uma vez', () => {
    renderTruncatedText('NF123456789012', 10);
    const button = getButton();

    act(() => { button.click(); });

    expect(button.textContent).toBe('NF123456789012');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('title')).toBe('NF123456789012');
  });

  it('recolhe o texto ao clicar duas vezes', () => {
    renderTruncatedText('NF123456789012', 10);
    const button = getButton();

    act(() => { button.click(); });
    act(() => { button.click(); });

    expect(button.textContent).toBe('NF12345678…');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('aplica className ao span quando o texto cabe no maxLength', () => {
    renderTruncatedText('ABC', 10, 'font-mono');

    expect(container.querySelector('span')?.className).toBe('font-mono');
  });
});
