import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InstallmentDraftTable from './InstallmentDraftTable';

import type { InstallmentDraft } from '../../types/payment';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
  vi.restoreAllMocks();
});

function draft(overrides: Partial<InstallmentDraft> = {}): InstallmentDraft {
  return {
    installmentNumber: 1,
    value: 100,
    dueDate: '2026-08-01',
    paymentMethod: 'boleto',
    ...overrides,
  };
}

function render(drafts: InstallmentDraft[], props: { sharedBoletoPath?: string; onUploadBoleto?: (index: number, file: File) => void } = {}) {
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(
      <InstallmentDraftTable
        drafts={drafts}
        onChange={() => {}}
        onUploadBoleto={props.onUploadBoleto ?? (() => {})}
        sharedBoletoPath={props.sharedBoletoPath}
      />,
    );
  });
  return root;
}

describe('InstallmentDraftTable', () => {
  it('sem boleto único, draft sem boletoUrl exibe "Boleto" e input de arquivo', () => {
    render([draft()]);
    expect(container.textContent).toContain('Boleto');
    expect(container.querySelector('input[type=file]')).not.toBeNull();
  });

  it('sem boleto único, draft com boletoUrl exibe "Boleto anexado"', () => {
    render([draft({ boletoUrl: 'path/a.pdf' })]);
    expect(container.textContent).toContain('Boleto anexado');
  });

  it('com boleto único, exibe "Boleto único" e não existe input de arquivo em nenhuma linha', () => {
    render([draft(), draft({ installmentNumber: 2 })], { sharedBoletoPath: 'path/shared.pdf' });
    const matches = container.textContent?.match(/Boleto único/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(container.querySelector('input[type=file]')).toBeNull();
  });

  it('com boleto único, onUploadBoleto nunca é chamado', () => {
    const onUploadBoleto = vi.fn();
    render([draft()], { sharedBoletoPath: 'path/shared.pdf', onUploadBoleto });
    expect(container.querySelector('input[type=file]')).toBeNull();
    expect(onUploadBoleto).not.toHaveBeenCalled();
  });

  it('sharedBoletoPath como string vazia é tratado como ausente', () => {
    render([draft()], { sharedBoletoPath: '' });
    expect(container.textContent).toContain('Boleto');
    expect(container.querySelector('input[type=file]')).not.toBeNull();
  });
});
