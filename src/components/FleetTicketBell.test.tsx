import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, authState } = vi.hoisted(() => ({
  listMock: vi.fn(),
  authState: { user: { role: 'Fleet Analyst' as string }, currentClient: { id: 'client-1' } },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../services/fleetTicketService', () => ({ listFleetTickets: listMock }));

import FleetTicketBell from './FleetTicketBell';

let container: HTMLDivElement;

const urgentSos = {
  id: 'sos-1', clientId: 'client-1', source: 'sos', openedBy: 'driver-1', openedByRole: 'Driver', openedByNameSnapshot: 'João', vehicleId: 'vehicle-1', vehicleLicensePlateSnapshot: 'ABC1D23', title: 'S.O.S. — Veículo enguiçado', status: 'open', criticality: 'critical', attachmentPaths: [], createdAt: '2026-07-29T10:00:00Z', updatedAt: '2026-07-29T10:00:00Z',
};
const closedTicket = {
  id: 'closed-1', clientId: 'client-1', source: 'report', openedBy: 'a', openedByRole: 'Yard Auditor', openedByNameSnapshot: 'Maria', vehicleId: 'vehicle-2', vehicleLicensePlateSnapshot: 'XYZ9K88', title: 'Fechado', status: 'closed', criticality: 'critical', attachmentPaths: [], createdAt: '2026-07-29T09:00:00Z', updatedAt: '2026-07-29T09:00:00Z',
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  listMock.mockResolvedValue([urgentSos, closedTicket]);
  authState.user = { role: 'Fleet Analyst' };
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderBell() {
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(<QueryClientProvider client={client}><MemoryRouter><FleetTicketBell /></MemoryRouter></QueryClientProvider>);
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  return root;
}

describe('FleetTicketBell', () => {
  it('does not render for Driver, Workshop or Financeiro', async () => {
    for (const role of ['Driver', 'Workshop', 'Financeiro']) {
      authState.user = { role };
      const root = await renderBell();
      expect(container.querySelector('button[aria-label="Chamados urgentes"]')).toBeNull();
      act(() => root.unmount());
    }
  });

  it('shows urgent count, dropdown and deep links', async () => {
    const root = await renderBell();
    expect(container.textContent).toContain('1');
    const button = container.querySelector('button[aria-label="Chamados urgentes"]') as HTMLButtonElement;
    act(() => button.click());
    expect(container.textContent).toContain('S.O.S.');
    expect(container.textContent).toContain('ABC1D23');
    expect(container.querySelector('a[href="/chamados?ticket=sos-1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/chamados"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
