import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = '11111111-1111-1111-1111-111111111111';

const { fromMock, updateSpy, deleteSpy } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  updateSpy: vi.fn((_payload: Record<string, unknown>) => ({ eq: () => Promise.resolve({ error: null }) })),
  deleteSpy: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', role: 'Manager', clientId: CLIENT_ID },
    currentClient: { id: CLIENT_ID, name: 'Cliente Teste' },
    clients: [{ id: CLIENT_ID, name: 'Cliente Teste' }],
  }),
}));

vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: () => Promise.resolve(new Map()),
  buildLastKmDisplayParts: () => ({
    prefix: 'Último Km:',
    valueText: null,
    suffix: null,
    fullText: 'Último Km: sem leitura',
  }),
}));

import WorkshopSchedules from './WorkshopSchedules';

const workshopSchedulesData = [
  {
    id: 'sch-1', client_id: CLIENT_ID, vehicle_id: 'veh-1', workshop_id: 'wks-1',
    scheduled_date: '2026-09-16', status: 'scheduled', completed_at: null,
    checklist_id: null, notes: 'Agendado para 10h.', created_by: 'usr-9',
  },
  {
    id: 'sch-2', client_id: CLIENT_ID, vehicle_id: 'veh-2', workshop_id: 'wks-1',
    scheduled_date: '2026-09-10', status: 'completed', completed_at: '2026-09-11T10:00:00.000Z',
    checklist_id: null, notes: null, created_by: 'usr-9',
  },
];

const vehiclesData = [
  { id: 'veh-1', license_plate: 'TXS8A77' },
  { id: 'veh-2', license_plate: 'SSB4J68' },
];

const workshopsData = [{
  id: 'wks-1', name: 'VAMOS',
  address_street: 'R. André Narciso Rodrigo', address_number: '50', address_complement: null,
  address_neighborhood: 'Ipiranga', address_city: 'Pouso Alegre', address_state: 'MG', address_zip: '37549-000',
}];

const profilesData = [{ id: 'usr-9', name: 'Maria Souza' }];

function chain(data: unknown) {
  const self = {
    select: vi.fn(() => self),
    order: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    update: updateSpy,
    delete: deleteSpy,
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
  } as unknown as Record<string, unknown>;
  return self;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fromMock.mockReset();
  updateSpy.mockClear();
  deleteSpy.mockClear();
  fromMock.mockImplementation((table: string) => {
    if (table === 'workshop_schedules') return chain(workshopSchedulesData) as never;
    if (table === 'vehicles') return chain(vehiclesData) as never;
    if (table === 'workshops') return chain(workshopsData) as never;
    if (table === 'profiles') return chain(profilesData) as never;
    return chain([]) as never;
  });
  sessionStorage.clear();
});

afterEach(() => {
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  if (container.parentNode) document.body.removeChild(container);
  sessionStorage.clear();
  vi.restoreAllMocks();
});

async function render() {
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkshopSchedules />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.querySelector('[aria-label="Ver detalhes do agendamento"]')) break;
  }
}

function buttonLabels(): string[] {
  return Array.from(document.body.querySelectorAll('button'))
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => t.length > 0);
}

async function openDetail(index: number) {
  const eyes = container.querySelectorAll('[aria-label="Ver detalhes do agendamento"]');
  await act(async () => {
    (eyes[index] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function clickButtonByLabel(label: string) {
  const btn = Array.from(document.body.querySelectorAll('button'))
    .find((b) => b.textContent?.trim() === label);
  expect(btn).toBeTruthy();
  await act(async () => {
    (btn as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('WorkshopSchedules.actions', () => {
  it('a linha da tabela não exibe mais nenhum botão de ação além do olho', async () => {
    await render();
    expect(container.querySelectorAll('[aria-label="Ver detalhes do agendamento"]').length).toBe(2);
    expect(container.querySelectorAll('[title="Editar"]').length).toBe(0);
    expect(container.querySelectorAll('[title="Concluir manualmente"]').length).toBe(0);
    expect(container.querySelectorAll('[title="Cancelar agendamento"]').length).toBe(0);
    expect(container.querySelectorAll('[title="Gerar OS de Manutenção"]').length).toBe(0);
    expect(container.querySelectorAll('[title="Excluir"]').length).toBe(0);
  });

  it('a linha não exibe mais o link Ver endereço nem o texto sem leitura', async () => {
    await render();
    expect(container.textContent).not.toContain('Ver endereço');
    expect(container.textContent).not.toContain('sem leitura');
    expect(container.textContent).toContain('TXS8A77');
    expect(container.textContent).toContain('SSB4J68');
  });

  it('o modal do agendamento agendado concentra as cinco ações', async () => {
    await render();
    await openDetail(0);
    expect(document.body.textContent).toContain('Detalhes do Agendamento');
    expect(buttonLabels()).toEqual(expect.arrayContaining(['Fechar', 'Editar', 'Gerar OS', 'Concluir', 'Cancelar agendamento']));
    expect(buttonLabels()).not.toContain('Excluir');
  });

  it('o modal do agendamento concluído troca as ações por Gerar OS e Excluir', async () => {
    await render();
    await openDetail(1);
    expect(document.body.textContent).toContain('Detalhes do Agendamento');
    expect(buttonLabels()).toEqual(expect.arrayContaining(['Fechar', 'Gerar OS', 'Excluir']));
    expect(buttonLabels()).not.toContain('Concluir');
    expect(buttonLabels()).not.toContain('Editar');
    expect(buttonLabels()).not.toContain('Cancelar agendamento');
  });

  it('cancelar o aviso de confirmação não altera nada', async () => {
    await render();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openDetail(0);
    await clickButtonByLabel('Cancelar agendamento');
    expect(confirmSpy).toHaveBeenCalledWith('Cancelar o agendamento do veículo TXS8A77 na oficina VAMOS? Esta ação não pode ser desfeita.');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Detalhes do Agendamento');
  });

  it('confirmar o cancelamento dispara o update e fecha o modal', async () => {
    await render();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openDetail(0);
    await clickButtonByLabel('Cancelar agendamento');
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toEqual({ status: 'cancelled', completed_at: undefined });
    expect(document.body.textContent).not.toContain('Detalhes do Agendamento');
  });

  it('confirmar a conclusão dispara o update com status completed e data preenchida', async () => {
    await render();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openDetail(0);
    await clickButtonByLabel('Concluir');
    expect(window.confirm).toHaveBeenCalledWith('Marcar como concluído o agendamento do veículo TXS8A77 na oficina VAMOS?');
    expect(updateSpy.mock.calls[0][0].status).toBe('completed');
    expect(typeof updateSpy.mock.calls[0][0].completed_at).toBe('string');
  });

  it('confirmar a exclusão dispara o delete', async () => {
    await render();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openDetail(1);
    await clickButtonByLabel('Excluir');
    expect(window.confirm).toHaveBeenCalledWith('Excluir o agendamento do veículo SSB4J68 na oficina VAMOS? Esta ação não pode ser desfeita.');
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
