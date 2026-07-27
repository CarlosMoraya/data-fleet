import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  },
}));

import WorkshopForm from './WorkshopForm';

import type { Workshop } from '../types';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

const COMPLETE_WORKSHOP: Workshop = {
  id: 'w-1',
  clientId: 'client-1',
  name: 'Oficina Central Ltda',
  cnpj: '11222333000181',
  phone: '11999998888',
  email: 'contato@oficina.com',
  contactPerson: 'Carlos Silva',
  addressStreet: 'Rua das Flores',
  addressNumber: '123',
  addressNeighborhood: 'Centro',
  addressCity: 'São Paulo',
  addressState: 'SP',
  addressZip: '01001000',
  specialties: ['Freios'],
  active: true,
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  sessionStorage.clear();
  vi.clearAllMocks();
});

function renderForm(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

function submitForm() {
  const form = container.querySelector<HTMLFormElement>('#workshop-form');
  expect(form).not.toBeNull();
  act(() => {
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('WorkshopForm — modo client (regressão)', () => {
  it('shows the "Oficina ativa" checkbox, the "Nova Oficina" title and an enabled CNPJ input', () => {
    renderForm(<WorkshopForm workshop={null} onClose={() => {}} onSave={async () => {}} />);

    expect(container.textContent).toContain('Nova Oficina');
    expect(container.textContent).toContain('Oficina ativa');
    expect(container.querySelector('#active')).not.toBeNull();

    const cnpjInput = container.querySelector<HTMLInputElement>('#cnpj');
    expect(cnpjInput).not.toBeNull();
    expect(cnpjInput!.disabled).toBe(false);
  });
});

describe('WorkshopForm — modo self', () => {
  it('hides the "Oficina ativa" checkbox, shows the self-service title and a disabled CNPJ input', () => {
    renderForm(
      <WorkshopForm mode="self" workshop={COMPLETE_WORKSHOP} onClose={() => {}} onSave={async () => {}} />
    );

    expect(container.textContent).toContain('Complete o cadastro da sua oficina');
    expect(container.textContent).not.toContain('Oficina ativa');
    expect(container.querySelector('#active')).toBeNull();
    expect(container.textContent).toContain(
      'O CNPJ identifica sua oficina nas parcerias e não pode ser alterado aqui.'
    );

    const cnpjInput = container.querySelector<HTMLInputElement>('#cnpj');
    expect(cnpjInput).not.toBeNull();
    expect(cnpjInput!.disabled).toBe(true);
    expect(cnpjInput!.value).toBe('11.222.333/0001-81');
  });

  it('blocks submit without any specialty and shows the validation message', async () => {
    const onSave = vi.fn<(w: Partial<Workshop>) => Promise<void>>().mockResolvedValue(undefined);
    renderForm(
      <WorkshopForm
        mode="self"
        workshop={{ ...COMPLETE_WORKSHOP, specialties: [] }}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    submitForm();

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Selecione ao menos uma especialidade.');
  });

  it('calls onSave exactly once when all required fields and one specialty are filled', async () => {
    const onSave = vi.fn<(w: Partial<Workshop>) => Promise<void>>().mockResolvedValue(undefined);
    renderForm(
      <WorkshopForm mode="self" workshop={COMPLETE_WORKSHOP} onClose={() => {}} onSave={onSave} />
    );

    submitForm();

    // Aguarda a resolução do handleSubmit assíncrono
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
