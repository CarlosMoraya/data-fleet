import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CameraCapture from './CameraCapture';

// A câmera é aberta dentro do <form> do modal "Preencher OS da Oficina".
// Botões sem type="button" enviavam esse formulário, salvando e fechando o
// modal antes de a foto ser anexada.

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: undefined,
    geolocation: { getCurrentPosition: vi.fn() },
  });
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview') });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CameraCapture dentro de um formulário', () => {
  it('não envia o formulário ao usar, refazer ou fechar a foto', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onCapture = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <form onSubmit={onSubmit}>
          <CameraCapture onCapture={onCapture} onClose={onClose} />
        </form>,
      );
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['x'], 'peca.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(button => expect(button.getAttribute('type')).toBe('button'));

    const byText = (text: string) => buttons.find(b => b.textContent?.includes(text))!;
    act(() => { byText('Refazer').click(); });
    act(() => { buttons[0].click(); });

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('confirma a foto sem enviar o formulário', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onCapture = vi.fn();

    await act(async () => {
      root.render(
        <form onSubmit={onSubmit}>
          <CameraCapture onCapture={onCapture} onClose={() => {}} />
        </form>,
      );
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['x'], 'peca.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const usar = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Usar foto'))!;
    act(() => { usar.click(); });

    expect(onCapture).toHaveBeenCalledWith(file, undefined, undefined);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
