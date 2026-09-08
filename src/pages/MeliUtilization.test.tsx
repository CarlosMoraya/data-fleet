import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeliRouteEntry } from '../types/meliUtilization';

const DELUNA_CLIENT_ID = '11111111-1111-1111-1111-111111111111';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

const getMeliRouteHistoryMock = vi.fn<
  (range: { from: string; to: string }) => Promise<MeliRouteEntry[]>
>();

vi.mock('../services/meliUtilizationService', () => ({
  getMeliRouteHistory: (range: { from: string; to: string }) => getMeliRouteHistoryMock(range),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'Manager', clientId: DELUNA_CLIENT_ID },
    currentClient: { id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' },
  }),
}));

let accessState = { canView: true };

vi.mock('../hooks/useMeliUtilizationAccess', () => ({
  useMeliUtilizationAccess: () => accessState,
}));

// eslint-disable-next-line import/order -- vi.mock calls above are hoisted by Vitest; SUT import must follow mock registration
import MeliUtilization from './MeliUtilization';

function vehicleRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'v-0',
    license_plate: 'ABC0D00',
    brand: 'Fiat',
    model: 'Fiorino',
    drivers: { name: 'Motorista' },
    operational_units: { code: 'SRJ1' },
    shippers: { name: 'MERCADO LIVRE' },
    ...overrides,
  };
}

const vehicles = [
  vehicleRow({
    id: 'v1',
    license_plate: 'ABC1D23',
    brand: 'Fiat',
    model: 'Fiorino',
    drivers: { name: 'Ana' },
    operational_units: { code: 'SRJ1' },
  }),
  vehicleRow({
    id: 'v2',
    license_plate: 'ABC2D34',
    brand: 'Fiat',
    model: 'Fiorino',
    drivers: { name: 'Bruno' },
    operational_units: { code: 'SRJ1' },
  }),
  vehicleRow({
    id: 'v3',
    license_plate: 'ABC3D45',
    brand: 'Renault',
    model: 'Master',
    drivers: { name: 'Carla' },
    operational_units: { code: 'SRJ10' },
  }),
  vehicleRow({
    id: 'v4',
    license_plate: 'ABC4D56',
    brand: 'Renault',
    model: 'Master',
    drivers: { name: 'Diego' },
    operational_units: { code: 'SRJ10' },
  }),
];

const routes: MeliRouteEntry[] = [
  {
    plate: 'ABC1D23',
    routeDate: '2026-09-06',
    routeId: '111',
    driverName: 'Ana',
    serviceCenter: 'SRJ1',
    cycle: null,
    odometerDistanceKm: null,
  },
  {
    plate: 'ABC3D45',
    routeDate: '2026-09-06',
    routeId: '222',
    driverName: 'Carla',
    serviceCenter: 'SRJ10',
    cycle: null,
    odometerDistanceKm: null,
  },
  {
    plate: 'ABC4D56',
    routeDate: '2026-09-06',
    routeId: '333',
    driverName: 'Diego',
    serviceCenter: 'SRJ10',
    cycle: null,
    odometerDistanceKm: null,
  },
];

function chain(resp: { data?: unknown; error?: unknown }) {
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: resp.data ?? [], error: resp.error ?? null }),
  };
  return self;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  accessState = { canView: true };
  getMeliRouteHistoryMock.mockReset();
  fromMock.mockReset();
  getMeliRouteHistoryMock.mockResolvedValue(routes);
  fromMock.mockImplementation((table: string) => {
    if (table === 'vehicles') return chain({ data: vehicles });
    if (table === 'maintenance_orders') return chain({ data: [], error: null });
    return chain({ data: [], error: null });
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
});

afterEach(() => {
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  vi.useRealTimers();
});

async function render(initialEntry = '/utilizacao-meli') {
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <MeliUtilization />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await Promise.resolve();
  });
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (!container.textContent?.includes('Carregando utilização MELI…')) break;
  }
}

function cardValue(label: string): string | null {
  const labels = [...container.querySelectorAll<HTMLParagraphElement>('.text-sm.font-medium.text-zinc-500')];
  const match = labels.find((element) => element.textContent === label);
  return match?.nextElementSibling?.textContent ?? null;
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
}

describe('MeliUtilization', () => {
  it('bloqueia sem acesso: Navigate e nenhum card', async () => {
    accessState = { canView: false };
    await render();

    expect(container.querySelectorAll('.rounded-2xl')).toHaveLength(0);
    expect(container.textContent).not.toContain('Total de veículos (MELI + Dedicado)');
    expect(container.textContent).not.toContain('Utilização MELI');
  });

  it('sem filtro de unidade, os cards exibem 4 · 3 · 1 · 75,0%', async () => {
    await render();

    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('4');
    expect(cardValue('Veículos Utilizados')).toBe('3');
    expect(cardValue('Não Utilizados')).toBe('1');
    expect(cardValue('% Utilização')).toBe('75,0%');
  });

  it('filtro SRJ1 recalcula os cards para 2 · 1 · 1 · 50,0%', async () => {
    await render('/utilizacao-meli?unit=SRJ1');

    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('2');
    expect(cardValue('Veículos Utilizados')).toBe('1');
    expect(cardValue('Não Utilizados')).toBe('1');
    expect(cardValue('% Utilização')).toBe('50,0%');
  });

  it('filtro SRJ10 recalcula os cards para 2 · 2 · 0 · 100,0%', async () => {
    await render('/utilizacao-meli?unit=SRJ10');

    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('2');
    expect(cardValue('Veículos Utilizados')).toBe('2');
    expect(cardValue('Não Utilizados')).toBe('0');
    expect(cardValue('% Utilização')).toBe('100,0%');
  });

  it('filtro de placa isolado recalcula tabela e cards', async () => {
    await render('/utilizacao-meli?plate=ABC2D34');

    expect(bodyRows()).toHaveLength(1);
    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('1');
    expect(cardValue('Veículos Utilizados')).toBe('0');
    expect(cardValue('Não Utilizados')).toBe('1');
    expect(cardValue('% Utilização')).toBe('0,0%');
  });

  it('filtro de utilização used recalcula tabela e cards', async () => {
    await render('/utilizacao-meli?utilization=used');

    expect(bodyRows()).toHaveLength(3);
    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('3');
    expect(cardValue('Veículos Utilizados')).toBe('3');
    expect(cardValue('Não Utilizados')).toBe('0');
    expect(cardValue('% Utilização')).toBe('100,0%');
  });

  it('filtro de utilização unused recalcula tabela e cards', async () => {
    await render('/utilizacao-meli?utilization=unused');

    expect(bodyRows()).toHaveLength(1);
    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('1');
    expect(cardValue('Veículos Utilizados')).toBe('0');
    expect(cardValue('Não Utilizados')).toBe('1');
    expect(cardValue('% Utilização')).toBe('0,0%');
  });

  it('combina filtros de unidade e utilização', async () => {
    await render('/utilizacao-meli?unit=SRJ10&utilization=used');

    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('ABC3D45');
    expect(rows[1].textContent).toContain('ABC4D56');
    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('2');
    expect(cardValue('Veículos Utilizados')).toBe('2');
    expect(cardValue('Não Utilizados')).toBe('0');
    expect(cardValue('% Utilização')).toBe('100,0%');
  });

  it('combina filtros de unidade e placa', async () => {
    await render('/utilizacao-meli?unit=SRJ1&plate=ABC1D23');

    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('ABC1D23');
    expect(cardValue('Total de veículos (MELI + Dedicado)')).toBe('1');
    expect(cardValue('Veículos Utilizados')).toBe('1');
    expect(cardValue('Não Utilizados')).toBe('0');
    expect(cardValue('% Utilização')).toBe('100,0%');
  });

  it('exibe o botão de exportação XLSX', async () => {
    await render();

    expect(container.textContent).toContain('Baixar XLSX');
  });

  it('com relógio em 2026-09-07, os inputs de data abrem em 2026-09-06', async () => {
    await render();

    const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('2026-09-06');
    expect(inputs[1].value).toBe('2026-09-06');
  });

  it('sem filtro, a tabela renderiza 4 linhas: três Utilizado e uma Não utilizado', async () => {
    await render();

    const rows = bodyRows();
    expect(rows).toHaveLength(4);
    expect(container.querySelectorAll('.inline-flex.rounded-full.bg-emerald-100')).toHaveLength(3);

    const idleRow = rows.find((row) => row.textContent?.includes('Não utilizado'));
    expect(idleRow?.textContent).toContain('ABC2D34');
  });
});
