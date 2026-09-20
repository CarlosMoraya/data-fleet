import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

vi.mock('../lib/budgetOcr', () => ({
  extractBudgetData: vi.fn(),
}));

vi.mock('../services/warrantyRevisionService', () => ({
  listPendingEventsForVehicle: vi.fn().mockResolvedValue([]),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'Manager' },
    currentClient: { id: 'client-1' },
  }),
}));

import MaintenanceForm from './MaintenanceForm';

import type { MaintenanceOrder } from '../types/maintenance';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

/** Query encadeada que resolve numa lista vazia em qualquer terminal usado pelo form. */
function emptyQuery() {
  const chain: Record<string, unknown> = {};
  const result = Promise.resolve({ data: [], error: null });
  for (const method of ['select', 'eq', 'order']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = result.then.bind(result);
  return chain;
}

function baseOrder(overrides: Partial<MaintenanceOrder>): MaintenanceOrder {
  return {
    id: 'os-1',
    clientId: 'client-1',
    vehicleId: 'v-1',
    workshopId: 'w-1',
    osNumber: 'OS-0001',
    entryDate: '2026-09-01',
    type: 'Corretiva',
    status: 'Aguardando orçamento',
    estimatedCost: 0,
    createdById: 'user-1',
    budgetDiscount: 0,
    ...overrides,
  } as MaintenanceOrder;
}

type SavedOrder = Partial<MaintenanceOrder>;

async function renderForm(
  order: MaintenanceOrder,
  onSave = vi.fn().mockResolvedValue(undefined),
) {
  const root = createRoot(container);
  container.__reactRoot = root;
  await act(async () => {
    root.render(
      <MaintenanceForm
        order={order}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    await Promise.resolve();
  });
  return { onSave };
}

function optionByText(text: string): HTMLOptionElement {
  const select = container.querySelector('#status') as HTMLSelectElement;
  const option = Array.from(select.options).find((o) => o.textContent === text);
  if (!option) throw new Error(`Opção "${text}" não encontrada`);
  return option;
}

/** Escreve num campo controlado pelo React e dispara o evento nativo correspondente. */
function setControlledValue(
  element: HTMLSelectElement | HTMLTextAreaElement,
  prototype: object,
  value: string,
  eventName: string,
) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') as
    { set?: (this: unknown, v: string) => void } | undefined;
  const setter = descriptor?.set;
  if (!setter) throw new Error('Setter de "value" não encontrado no protótipo');
  setter.call(element, value);
  element.dispatchEvent(new Event(eventName, { bubbles: true }));
}

async function selectStatus(value: string) {
  const select = container.querySelector('#status') as HTMLSelectElement;
  await act(async () => {
    setControlledValue(select, HTMLSelectElement.prototype, value, 'change');
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  fromMock.mockReset();
  fromMock.mockImplementation(() => emptyQuery());
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  act(() => { container.__reactRoot?.unmount(); });
  container.remove();
});

describe('MaintenanceForm — trava de orçamento', () => {
  it('1. desabilita "Orçamento aprovado" numa OS sem orçamento aprovado', async () => {
    await renderForm(baseOrder({ status: 'Aguardando orçamento', budgetStatus: 'sem_orcamento' }));

    expect(optionByText('Orçamento aprovado').disabled).toBe(true);
    expect(optionByText('Serviço em execução').disabled).toBe(false);
  });

  it('2. habilita "Orçamento aprovado" quando o orçamento está aprovado', async () => {
    await renderForm(baseOrder({ status: 'Orçamento aprovado', budgetStatus: 'aprovado' }));

    expect(optionByText('Orçamento aprovado').disabled).toBe(false);
  });

  it('3. exibe a nota de apoio só sem aprovação', async () => {
    await renderForm(baseOrder({ status: 'Aguardando orçamento', budgetStatus: 'sem_orcamento' }));
    expect(container.querySelector('[data-testid="budget-approved-hint"]')).not.toBeNull();

    act(() => { container.__reactRoot?.unmount(); });
    container.remove();
    container = document.createElement('div') as RootedDiv;
    document.body.appendChild(container);

    await renderForm(baseOrder({ status: 'Orçamento aprovado', budgetStatus: 'aprovado' }));
    expect(container.querySelector('[data-testid="budget-approved-hint"]')).toBeNull();
  });

  it('3b. desabilita os dois status pré-aprovação quando o orçamento já foi aprovado', async () => {
    await renderForm(baseOrder({ status: 'Orçamento aprovado', budgetStatus: 'aprovado' }));

    for (const alvo of ['Aguardando orçamento', 'Aguardando aprovação']) {
      const option = optionByText(alvo);
      expect(option.disabled).toBe(true);
      expect(option.title).toBe(
        `Este orçamento já foi aprovado no Financeiro, então a OS não volta para "${alvo}". Para revisá-lo, use "Reabrir orçamento".`,
      );
    }
  });

  it('3c. mantém os dois habilitados sem orçamento aprovado', async () => {
    await renderForm(baseOrder({ status: 'Serviço em execução', budgetStatus: 'sem_orcamento' }));

    expect(optionByText('Aguardando orçamento').disabled).toBe(false);
    expect(optionByText('Aguardando aprovação').disabled).toBe(false);
  });

  it('4. mostra o bloco de exceção ao escolher um status da faixa operacional', async () => {
    await renderForm(baseOrder({ status: 'Aguardando orçamento', budgetStatus: 'sem_orcamento' }));

    expect(container.querySelector('[data-testid="budget-override-block"]')).toBeNull();

    await selectStatus('Serviço em execução');

    const block = container.querySelector('[data-testid="budget-override-block"]');
    expect(block).not.toBeNull();
    expect(block!.textContent).toContain(
      'Esta OS não tem orçamento aprovado. Mudar para "Serviço em execução" é uma exceção e ficará registrada com o seu nome, a data e o motivo informado.',
    );
  });

  it('5. não mostra o bloco em transição dentro da faixa operacional', async () => {
    await renderForm(baseOrder({ status: 'Serviço em execução', budgetStatus: 'sem_orcamento' }));

    await selectStatus('Concluído');

    expect(container.querySelector('[data-testid="budget-override-block"]')).toBeNull();
  });

  it('6. recusa o salvamento sem motivo, antes da rede', async () => {
    const { onSave } = await renderForm(baseOrder({ status: 'Aguardando orçamento', budgetStatus: 'sem_orcamento' }));

    await selectStatus('Serviço em execução');

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Informe o motivo da exceção (até 500 caracteres).');
  });

  it('7. entrega o motivo preenchido ao onSave', async () => {
    const { onSave } = await renderForm(baseOrder({ status: 'Aguardando orçamento', budgetStatus: 'sem_orcamento' }));

    await selectStatus('Serviço em execução');

    const textarea = container.querySelector('#budget-override-reason') as HTMLTextAreaElement;
    await act(async () => {
      setControlledValue(textarea, HTMLTextAreaElement.prototype, 'motor fundido', 'input');
      await Promise.resolve();
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as SavedOrder;
    expect(saved.budgetOverrideReason).toBe('motor fundido');
    expect(saved.status).toBe('Serviço em execução');
  });
});
