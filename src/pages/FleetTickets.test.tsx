import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, lastKmMock, slaSettingsMock, idsWithActionPlanMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  lastKmMock: vi.fn(),
  slaSettingsMock: vi.fn(),
  idsWithActionPlanMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'Fleet Analyst' }, currentClient: { id: 'client-1' } }),
}));
vi.mock('../services/fleetTicketService', () => ({
  listFleetTickets: listMock,
  listFleetTicketEvents: vi.fn().mockResolvedValue([]),
  getFleetTicketAttachmentUrls: vi.fn().mockResolvedValue({}),
  listFleetTicketIdsWithActionPlan: idsWithActionPlanMock,
}));
vi.mock('../services/fleetTicketSlaSettingsService', () => ({
  getFleetTicketSlaSettings: slaSettingsMock,
}));
vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: lastKmMock,
  buildLastKmDisplayParts: (info: { value?: number } | null | undefined) => ({
    prefix: 'Último Km:',
    valueText: info?.value == null ? null : `${info.value} km`,
    suffix: null,
    fullText: info?.value == null ? 'Último Km: sem leitura' : `Último Km: ${info.value} km`,
  }),
}));
vi.mock('../components/CreateFleetTicketModal', () => ({ default: () => null }));
vi.mock('../components/FleetTicketModal', () => ({ default: () => null }));

import FleetTickets from './FleetTickets';

let container: HTMLDivElement;
let queryClient: QueryClient;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

const rows = [
  {
    id: 'sos-1', clientId: 'client-1', source: 'sos', openedBy: 'driver-1', openedByRole: 'Driver', openedByNameSnapshot: 'João', driverId: 'driver-1', driverNameSnapshot: 'João', vehicleId: 'vehicle-1', vehicleLicensePlateSnapshot: 'ABC1D23', sosType: 'breakdown', title: 'S.O.S.', description: 'Falha', criticality: 'critical', status: 'open', attachmentPaths: [], createdAt: hoursAgo(30), updatedAt: hoursAgo(30), ticketNumber: 'CH-2607-4821', vehicleModelSnapshot: 'Volvo FH',
  },
  {
    id: 'report-1', clientId: 'client-1', source: 'report', openedBy: 'auditor-1', openedByRole: 'Yard Auditor', openedByNameSnapshot: 'Maria', vehicleId: 'vehicle-2', vehicleLicensePlateSnapshot: 'XYZ9K88', title: 'Pneu danificado', description: 'Descrição do problema', status: 'open', attachmentPaths: [], createdAt: hoursAgo(2), updatedAt: hoursAgo(2), vehicleModelSnapshot: 'Scania R450',
  },
  {
    id: 'closed-1', clientId: 'client-1', source: 'report', openedBy: 'auditor-1', openedByRole: 'Yard Auditor', openedByNameSnapshot: 'Maria', vehicleId: 'vehicle-3', vehicleLicensePlateSnapshot: 'DEF4G56', title: 'Chamado encerrado', description: 'Já resolvido', criticality: 'low', status: 'closed', attachmentPaths: [], createdAt: hoursAgo(200), updatedAt: hoursAgo(200),
  },
];

beforeEach(() => {
  window.sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  listMock.mockResolvedValue(rows);
  lastKmMock.mockResolvedValue(new Map());
  slaSettingsMock.mockResolvedValue({ clientId: 'client-1', openSlaHours: 24, assignedSlaHours: 72 });
  idsWithActionPlanMock.mockResolvedValue(new Set());
});

afterEach(() => {
  document.body.removeChild(container);
  queryClient.clear();
  vi.clearAllMocks();
});

async function renderPage(initialEntry = '/chamados') {
  const root = createRoot(container);
  act(() => {
    root.render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}><FleetTickets /></MemoryRouter></QueryClientProvider>);
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return root;
}

async function waitForText(text: string) {
  for (let i = 0; i < 20; i += 1) {
    if (container.textContent?.includes(text)) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error(`Texto não encontrado: ${text}`);
}

describe('FleetTickets', () => {
  it('lists tickets', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    expect(container.textContent).toContain('ABC1D23');
    act(() => root.unmount());
  });

  it('shows "Encerrado com plano de ação" for a closed ticket present in the Set', async () => {
    idsWithActionPlanMock.mockResolvedValue(new Set(['closed-1']));
    const root = await renderPage();
    await waitForText('Encerrado com plano de ação');
    act(() => root.unmount());
  });

  it('does not show the pill for a closed ticket outside the Set', async () => {
    idsWithActionPlanMock.mockResolvedValue(new Set());
    const root = await renderPage();
    await waitForText('XYZ9K88');
    expect(container.textContent).not.toContain('Encerrado com plano de ação');
    expect(container.textContent).not.toContain('Com plano de ação');
    act(() => root.unmount());
  });

  it('filters S.O.S. cards', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const sosCard = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('S.O.S.'))!;
    act(() => sosCard.click());
    expect(container.textContent).toContain('ABC1D23');
    expect(container.textContent).not.toContain('XYZ9K88');
    act(() => root.unmount());
  });

  it('filters unclassified reports', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const card = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Não classificados'))!;
    act(() => card.click());
    expect(container.textContent).toContain('XYZ9K88');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    act(() => root.unmount());
  });

  it('searches by plate and title', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const input = container.querySelector('input[placeholder*="placa"]') as HTMLInputElement;
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setInputValue?.call(input, 'Pneu danificado');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('XYZ9K88');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    act(() => root.unmount());
  });

  it('opens a deep-linked ticket modal', async () => {
    const root = await renderPage('/chamados?ticket=sos-1');
    await waitForText('S.O.S.');
    expect(container.textContent).toContain('S.O.S.');
    act(() => root.unmount());
  });

  it('renders an edit button for active tickets', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    expect(container.querySelector('button[aria-label="Editar chamado"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it('renders a view button (not edit) for closed tickets', async () => {
    const root = await renderPage();
    await waitForText('DEF4G56');
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes('DEF4G56'))!;
    expect(row.querySelector('button[aria-label="Visualizar chamado"]')).not.toBeNull();
    expect(row.querySelector('button[aria-label="Editar chamado"]')).toBeNull();
    act(() => root.unmount());
  });

  it('shows the ticket number in the Tipo cell', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    expect(container.textContent).toContain('CH-2607-4821');
    act(() => root.unmount());
  });

  it('no longer has a "Criado em" column and shows the date under "Aberto por"', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent);
    expect(headers).not.toContain('Criado em');
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes('João'))!;
    expect(row.textContent).toContain('João');
    act(() => root.unmount());
  });

  it('reduces displayed rows when a Modelo filter is selected', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const modelSelect = Array.from(container.querySelectorAll('select')).find((select) => select.textContent?.includes('Modelo'))!;
    const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setSelectValue?.call(modelSelect, 'Volvo FH');
      modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('ABC1D23');
    expect(container.textContent).not.toContain('XYZ9K88');
    act(() => root.unmount());
  });

  it('filters tickets by status', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const statusSelect = container.querySelector('select[aria-label="Filtrar chamados por status"]') as HTMLSelectElement;
    const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setSelectValue?.call(statusSelect, 'closed');
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('DEF4G56');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    act(() => root.unmount());
  });

  it('combines the status filter with the criticality card', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const criticalCard = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Crítico'))!;
    act(() => criticalCard.click());
    await waitForText('ABC1D23');
    const statusSelect = container.querySelector('select[aria-label="Filtrar chamados por status"]') as HTMLSelectElement;
    const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setSelectValue?.call(statusSelect, 'open');
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('ABC1D23');
    act(() => root.unmount());
  });

  it('shows the age counter below the status for an open ticket', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes('XYZ9K88'))!;
    expect(row.textContent).toContain('há 2 h');
    act(() => root.unmount());
  });

  it('does not show the age counter for a closed ticket', async () => {
    const root = await renderPage();
    await waitForText('DEF4G56');
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes('DEF4G56'))!;
    expect(row.textContent).not.toContain('há');
    act(() => root.unmount());
  });

  it('reduces displayed rows to only breached tickets when "SLA estourado" is selected', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const slaSelect = container.querySelector('select[aria-label="Filtrar chamados por SLA"]') as HTMLSelectElement;
    const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setSelectValue?.call(slaSelect, 'breached');
      slaSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('ABC1D23');
    act(() => root.unmount());
  });

  it('combines "SLA estourado" with the Crítico card', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const criticalCard = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Crítico'))!;
    act(() => criticalCard.click());
    await waitForText('ABC1D23');
    const slaSelect = container.querySelector('select[aria-label="Filtrar chamados por SLA"]') as HTMLSelectElement;
    const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setSelectValue?.call(slaSelect, 'breached');
      slaSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('ABC1D23');
    act(() => root.unmount());
  });

  it('combines "SLA estourado" with the Status: Aberto filter', async () => {
    const root = await renderPage();
    await waitForText('XYZ9K88');
    const statusSelect = container.querySelector('select[aria-label="Filtrar chamados por status"]') as HTMLSelectElement;
    const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setSelectValue?.call(statusSelect, 'open');
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await waitForText('ABC1D23');
    const slaSelect = container.querySelector('select[aria-label="Filtrar chamados por SLA"]') as HTMLSelectElement;
    act(() => {
      setSelectValue?.call(slaSelect, 'breached');
      slaSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('ABC1D23');
    act(() => root.unmount());
  });
});
