import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExtraPaymentEvidencePhotos from './ExtraPaymentEvidencePhotos';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function image(name: string, sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'image/jpeg' });
}

function render(files: File[], onChange: (files: File[]) => void, disabled = false) {
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(<ExtraPaymentEvidencePhotos files={files} onChange={onChange} disabled={disabled} />);
  });
  return root;
}

function fileInput(): HTMLInputElement {
  return container.querySelector('input[type=file]') as HTMLInputElement;
}

function pickFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ExtraPaymentEvidencePhotos', () => {
  it('renderiza "0/3 fotos" com lista vazia', () => {
    render([], vi.fn());
    expect(container.textContent).toContain('0/3 fotos');
  });

  it('selecionar 2 imagens chama onChange com 2 arquivos', () => {
    const onChange = vi.fn();
    render([], onChange);
    act(() => {
      pickFiles(fileInput(), [image('a.jpg'), image('b.jpg')]);
    });
    expect(onChange).toHaveBeenCalledWith([expect.any(File), expect.any(File)]);
  });

  it('selecionar 4 imagens de uma vez recebe apenas 3 e mostra mensagem de excedente', () => {
    const onChange = vi.fn();
    render([], onChange);
    act(() => {
      pickFiles(fileInput(), [image('a.jpg'), image('b.jpg'), image('c.jpg'), image('d.jpg')]);
    });
    expect(onChange).toHaveBeenCalledWith([expect.any(File), expect.any(File), expect.any(File)]);
    expect(container.textContent).toContain('Limite de 3 fotos atingido');
  });

  it('com 3 fotos, o botão "Adicionar foto" está desabilitado', () => {
    render([image('a.jpg'), image('b.jpg'), image('c.jpg')], vi.fn());
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Adicionar foto'),
    );
    expect(button?.disabled).toBe(true);
  });

  it('selecionar um PDF não chama onChange e exibe "Apenas imagens"', () => {
    const onChange = vi.fn();
    render([], onChange);
    const pdf = new File([new Uint8Array(1024)], 'doc.pdf', { type: 'application/pdf' });
    act(() => {
      pickFiles(fileInput(), [pdf]);
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Apenas imagens');
  });

  it('remover a foto do meio mantém as outras 2 na ordem original', () => {
    const onChange = vi.fn();
    const files = [image('a.jpg'), image('b.jpg'), image('c.jpg')];
    render(files, onChange);

    const removeButtons = container.querySelectorAll('button');
    const trashButtons = Array.from(removeButtons).filter((b) => b.querySelector('svg'));
    // trashButtons[0] é o botão "Adicionar foto"; [1..3] são os removedores das 3 miniaturas.
    act(() => {
      trashButtons[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith([files[0], files[2]]);
  });
});
