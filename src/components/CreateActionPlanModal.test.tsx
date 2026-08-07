import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, insertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'Fleet Analyst' },
    currentClient: { id: 'client-1' },
  }),
}));

import CreateActionPlanModal from './CreateActionPlanModal';

import type { Checklist } from '../types';
import type { FleetTicket } from '../types/fleetTicket';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

function checklistResponsesQuery(issueItems: Array<Record<string, unknown>>) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: issueItems, error: null }).then(resolve);
  return query;
}

function profilesQuery(profiles: Array<Record<string, unknown>>) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.not = vi.fn(() => query);
  query.order = vi.fn(() => Promise.resolve({ data: profiles, error: null }));
  query.select = vi.fn(() => query);
  return query;
}

const profiles = [{ id: 'resp-1', name: 'Ana Responsável', role: 'Fleet Analyst' }];

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  fromMock.mockReset();
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });

  fromMock.mockImplementation((table: string) => {
    if (table === 'checklist_responses') return checklistResponsesQuery([]);
    if (table === 'profiles') return profilesQuery(profiles);
    if (table === 'action_plans') return { insert: insertMock };
    throw new Error(`unexpected table ${table}`);
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => { root.unmount(); });
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function baseTicket(overrides: Partial<FleetTicket> = {}): FleetTicket {
  return {
    id: 'ticket-1',
    clientId: 'client-1',
    source: 'report',
    openedBy: 'opener-1',
    openedByRole: 'Yard Auditor',
    openedByNameSnapshot: 'Maria',
    vehicleId: 'vehicle-1',
    vehicleLicensePlateSnapshot: 'ABC1D23',
    title: 'Vazamento de óleo',
    description: 'Óleo vazando pelo motor',
    status: 'in_progress',
    assignedTo: 'user-1',
    attachmentPaths: [],
    ticketNumber: 'CH-2608-0001',
    createdAt: '2026-08-07T10:00:00Z',
    updatedAt: '2026-08-07T10:00:00Z',
    ...overrides,
  };
}

function baseChecklist(overrides: Partial<Checklist> = {}): Checklist {
  return {
    id: 'checklist-1',
    clientId: 'client-1',
    templateId: 'template-1',
    templateName: 'Checklist de saída',
    versionNumber: 1,
    vehicleId: 'vehicle-1',
    vehicleLicensePlate: 'ABC1D23',
    filledBy: 'driver-1',
    startedAt: '2026-08-07T09:00:00Z',
    status: 'completed',
    ...overrides,
  };
}

function fillCommonFields(name: string, dueDate: string) {
  const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
  const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
  const select = container.querySelector('select') as HTMLSelectElement;
  const textSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    textSetter?.call(nameInput, name);
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    selectSetter?.call(select, 'resp-1');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    textSetter?.call(dateInput, dueDate);
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickCreate() {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Criar'))!;
  act(() => { button.click(); });
}

describe('CreateActionPlanModal — origem chamado', () => {
  it('pré-preenche Ação sugerida e Problema observado e cria um único plano com fleet_ticket_id', async () => {
    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'fleetTicket', ticket: baseTicket() }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();

    const textareas = container.querySelectorAll('textarea');
    expect((textareas[0] as HTMLTextAreaElement).value).toBe('Tratar chamado CH-2608-0001: Vazamento de óleo');
    expect((textareas[1] as HTMLTextAreaElement).value).toBe('Óleo vazando pelo motor');

    fillCommonFields('Corrigir vazamento', '2026-08-15');
    clickCreate();
    await flush();

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(Array.isArray(payload)).toBe(false);
    expect(payload.fleet_ticket_id).toBe('ticket-1');
    expect(payload.checklist_id).toBeUndefined();
    expect(payload.reported_by).toBe('opener-1');
    expect(payload.assigned_by).toBe('user-1');
  });

  it('envia o texto editado de Ação sugerida, não o inicial', async () => {
    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'fleetTicket', ticket: baseTicket() }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();

    const textarea = container.querySelectorAll('textarea')[0] as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(textarea, 'Ação editada pelo usuário');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    fillCommonFields('Corrigir vazamento', '2026-08-15');
    clickCreate();
    await flush();

    const payload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.suggested_action).toBe('Ação editada pelo usuário');
  });

  it('não chama insert e mostra erro quando o nome está vazio', async () => {
    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'fleetTicket', ticket: baseTicket() }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();
    clickCreate();
    await flush();

    expect(container.textContent).toContain('Informe o nome da ação.');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('não chama insert e mostra erro quando o responsável está vazio', async () => {
    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'fleetTicket', ticket: baseTicket() }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();

    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const textSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      textSetter?.call(nameInput, 'Corrigir vazamento');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      textSetter?.call(dateInput, '2026-08-15');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    clickCreate();
    await flush();

    expect(container.textContent).toContain('Selecione um responsável.');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('não chama insert e mostra erro quando a data limite está vazia', async () => {
    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'fleetTicket', ticket: baseTicket() }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();

    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const select = container.querySelector('select') as HTMLSelectElement;
    const textSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      textSetter?.call(nameInput, 'Corrigir vazamento');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      selectSetter?.call(select, 'resp-1');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    clickCreate();
    await flush();

    expect(container.textContent).toContain('Informe a data limite.');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('chamado sem description inicia Problema observado vazio e envia observed_issue: null', async () => {
    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'fleetTicket', ticket: baseTicket({ description: undefined }) }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();

    const observedTextarea = container.querySelectorAll('textarea')[1] as HTMLTextAreaElement;
    expect(observedTextarea.value).toBe('');

    fillCommonFields('Corrigir vazamento', '2026-08-15');
    clickCreate();
    await flush();

    const payload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.observed_issue).toBeNull();
  });
});

describe('CreateActionPlanModal — origem checklist (regressão)', () => {
  it('cria um array com um payload por item não conforme, todos com checklist_id e sem fleet_ticket_id', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'checklist_responses') {
        return checklistResponsesQuery([
          { id: 'resp-a', item_id: 'item-a', observation: 'Freio gasto', photo_url: null, checklist_items: { title: 'Freios', default_action: 'Trocar pastilhas' } },
          { id: 'resp-b', item_id: 'item-b', observation: 'Pneu careca', photo_url: null, checklist_items: { title: 'Pneus', default_action: 'Trocar pneu' } },
        ]);
      }
      if (table === 'profiles') return profilesQuery(profiles);
      if (table === 'action_plans') return { insert: insertMock };
      throw new Error(`unexpected table ${table}`);
    });

    renderWithAct(
      <CreateActionPlanModal origin={{ kind: 'checklist', checklist: baseChecklist() }} onClose={() => {}} onCreated={() => {}} />,
    );
    await flush();

    fillCommonFields('Plano geral', '2026-08-15');
    clickCreate();
    await flush();

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payloads = insertMock.mock.calls[0][0] as Record<string, unknown>[];
    expect(Array.isArray(payloads)).toBe(true);
    expect(payloads).toHaveLength(2);
    for (const payload of payloads) {
      expect(payload.checklist_id).toBe('checklist-1');
      expect(payload.fleet_ticket_id).toBeUndefined();
    }
  });
});
