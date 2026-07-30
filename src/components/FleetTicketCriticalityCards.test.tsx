import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FleetTicketCriticalityCards from './FleetTicketCriticalityCards';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

const counts = { sos: 2, unclassified: 3, critical: 4, high: 5, medium: 6, low: 7, all: 27 };

function render(onChange = vi.fn()) {
  const root = createRoot(container);
  act(() => {
    root.render(<FleetTicketCriticalityCards counts={counts} activeFilter="all" onChange={onChange} />);
  });
  return { root, onChange };
}

describe('FleetTicketCriticalityCards', () => {
  it('renders all card counts', () => {
    const { root } = render();
    expect(container.textContent).toContain('Não classificados');
    expect(container.textContent).toContain('27');
    expect(container.textContent).toContain('2');
    act(() => root.unmount());
  });

  it('calls the selected filter when a card is clicked', () => {
    const { root, onChange } = render();
    const critical = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Crítico'))!;
    act(() => critical.click());
    expect(onChange).toHaveBeenCalledWith('critical');
    act(() => root.unmount());
  });

  it('highlights S.O.S. when there are urgent tickets', () => {
    const { root } = render();
    const sos = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('S.O.S.'))!;
    expect(sos.className).toContain('animate-pulse');
    act(() => root.unmount());
  });

  it('shows the unclassified count', () => {
    const { root } = render();
    const card = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Não classificados'))!;
    expect(card.textContent).toContain('3');
    act(() => root.unmount());
  });
});
