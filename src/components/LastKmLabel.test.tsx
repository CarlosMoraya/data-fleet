import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import LastKmLabel from './LastKmLabel';

describe('LastKmLabel', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  function render(info: Parameters<typeof LastKmLabel>[0]['info']) {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<LastKmLabel info={info} />);
    });
    return container;
  }

  it('exibe fallback quando não há leitura', () => {
    const el = render(null);
    expect(el.textContent).toBe('Último Km: sem leitura');
  });

  it('exibe leitura normal sem (Editado)', () => {
    const el = render({ value: 38001, isCorrected: false });
    expect(el.textContent).toBe('Último Km: 38.001 km');
  });

  it('exibe leitura corrigida com (Editado)', () => {
    const el = render({ value: 38001, isCorrected: true });
    expect(el.textContent).toBe('Último Km: 38.001 km (Editado)');
  });
});
