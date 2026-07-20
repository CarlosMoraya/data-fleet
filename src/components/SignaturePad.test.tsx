import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SignaturePad from './SignaturePad';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  const mockCtx = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineCap: '',
    lineJoin: '',
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
  };

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb: (b: Blob | null) => void) => {
    cb(new Blob(['fake'], { type: 'image/jpeg' }));
  });
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    x: 0, y: 0, width: 300, height: 150, top: 0, left: 0, right: 300, bottom: 150, toJSON: () => ({}),
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

async function renderPad(onConfirm: (file: File) => void, onClose: () => void = () => {}) {
  const root = createRoot(container);
  container.__reactRoot = root;

  await act(async () => {
    root.render(<SignaturePad onConfirm={onConfirm} onClose={onClose} />);
    await Promise.resolve();
  });
}

function draw(canvas: HTMLCanvasElement) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 20, bubbles: true, pointerId: 1 }));
  });
}

describe('SignaturePad', () => {
  it('após desenhar um traço, o botão Confirmar fica habilitado', async () => {
    const onConfirm = vi.fn();
    await renderPad(onConfirm);

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    draw(canvas);

    const confirmButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Confirmar'));
    expect(confirmButton?.disabled).toBe(false);
  });

  it('sem nenhum traço, Confirmar está desabilitado e onConfirm nunca é chamado', async () => {
    const onConfirm = vi.fn();
    await renderPad(onConfirm);

    const confirmButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Confirmar')) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    act(() => {
      confirmButton.click();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('após Limpar, Confirmar volta a ficar desabilitado', async () => {
    const onConfirm = vi.fn();
    await renderPad(onConfirm);

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    draw(canvas);

    const clearButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Limpar')) as HTMLButtonElement;
    act(() => {
      clearButton.click();
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Confirmar')) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });
});
