import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = '11111111-1111-1111-1111-111111111111';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', role: 'Operations Manager', clientId: CLIENT_ID },
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
    id: 'sch-1',
    client_id: CLIENT_ID,
    vehicle_id: 'veh-1',
    workshop_id: 'wks-1',
    scheduled_date: '2026-09-16',
    status: 'scheduled',
    completed_at: null,
    checklist_id: null,
    notes: 'Agendado para 10h. Procurar o mecânico Tião.',
    created_by: 'usr-9',
  },
];

const vehiclesData = [{ id: 'veh-1', license_plate: 'TXS8A77' }];

const workshopsData = [
  {
    id: 'wks-1',
    name: 'VAMOS',
    address_street: 'R. André Narciso Rodrigo',
    address_number: '50',
    address_complement: null,
    address_neighborhood: 'Ipiranga',
    address_city: 'Pouso Alegre',
    address_state: 'MG',
    address_zip: '37549-000',
  },
];

const profilesData = [{ id: 'usr-9', name: 'Maria Souza' }];

function chain(data: unknown) {
  const self = {
    select: vi.fn(() => self),
    order: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
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

describe('WorkshopSchedules.detailModal', () => {
  it('Gestor de Operações vê o botão de detalhes e não vê o botão de edição', async () => {
    await render();

    expect(container.querySelectorAll('[aria-label="Ver detalhes do agendamento"]').length).toBe(1);
    expect(container.querySelectorAll('[title="Editar"]').length).toBe(0);
    expect(container.querySelectorAll('[title="Excluir"]').length).toBe(0);
  });

  it('abrir o modal exibe o endereço completo da oficina e as observações do time de frota', async () => {
    await render();

    const eye = container.querySelector('[aria-label="Ver detalhes do agendamento"]') as HTMLElement;
    expect(eye).not.toBeNull();

    await act(async () => {
      eye.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.textContent).toContain('R. André Narciso Rodrigo, 50');
    expect(document.body.textContent).toContain('Ipiranga, Pouso Alegre - MG, 37549-000');
    expect(document.body.textContent).toContain('Agendado para 10h. Procurar o mecânico Tião.');
    expect(document.body.textContent).toContain('Detalhes do Agendamento');
  });

  it('o modal aberto não expõe controles de edição', async () => {
    await render();

    const eye = container.querySelector('[aria-label="Ver detalhes do agendamento"]') as HTMLElement;
    await act(async () => {
      eye.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Provar primeiro que o modal abriu: sem esta âncora, as duas asserções de
    // ausência abaixo passariam mesmo que o clique não tivesse efeito nenhum.
    expect(document.body.textContent).toContain('Detalhes do Agendamento');

    expect(document.querySelectorAll('form').length).toBe(0);
    expect(document.body.textContent).not.toContain('Salvar Alterações');
  });
});
