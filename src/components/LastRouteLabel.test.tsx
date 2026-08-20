import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import LastRouteLabel from './LastRouteLabel';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
});

describe('LastRouteLabel', () => {
  it('renderiza o texto da última rota', () => {
    act(() => {
      root.render(
        <LastRouteLabel info={{ lastRouteDate: '2026-08-15', routeId: '425129405' }} />,
      );
    });

    expect(container.textContent).toBe('Últ. rota 15/08/2026 · #425129405');
  });

  it('não renderiza elemento quando não há rota', () => {
    act(() => {
      root.render(<LastRouteLabel info={undefined} />);
    });

    expect(container.innerHTML).toBe('');
  });

  it('renderiza somente a data na variante dateOnly', () => {
    act(() => {
      root.render(<LastRouteLabel info={{ lastRouteDate: '2026-08-15', routeId: '425129405' }} variant="dateOnly" />);
    });

    expect(container.textContent).toBe('Últ. rota 15/08/2026');
    expect(container.textContent).not.toContain('425129405');
  });

  it('não renderiza elemento na variante dateOnly quando não há rota', () => {
    act(() => {
      root.render(<LastRouteLabel info={undefined} variant="dateOnly" />);
    });

    expect(container.innerHTML).toBe('');
  });
});
