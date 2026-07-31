import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, listEventsMock, attachmentUrlsMock, lastKmMapMock } = vi.hoisted(() => ({
  authState: { user: { role: 'Fleet Assistant' as string } },
  listEventsMock: vi.fn(),
  attachmentUrlsMock: vi.fn(),
  lastKmMapMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../services/fleetTicketService', () => ({
  assignFleetTicketToSelf: vi.fn(),
  classifyFleetTicket: vi.fn(),
  getFleetTicketAttachmentUrls: attachmentUrlsMock,
  listFleetTicketEvents: listEventsMock,
  updateFleetTicketStatus: vi.fn(),
}));
vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: lastKmMapMock,
  buildLastKmDisplayParts: (info: { value: number; isCorrected: boolean } | null) =>
    info == null
      ? { prefix: 'Último Km:', valueText: null, suffix: null, fullText: 'Último Km: sem leitura' }
      : { prefix: 'Último Km:', valueText: `${info.value.toLocaleString('pt-BR')} km`, suffix: null, fullText: `Último Km: ${info.value.toLocaleString('pt-BR')} km` },
}));

import FleetTicketModal from './FleetTicketModal';

import type { FleetTicket } from '../types/fleetTicket';

let container: HTMLDivElement;

function baseTicket(overrides: Partial<FleetTicket> = {}): FleetTicket {
  return {
    id: 'ticket-1',
    clientId: 'client-1',
    source: 'report',
    openedBy: 'user-1',
    openedByRole: 'Yard Auditor',
    openedByNameSnapshot: 'Maria',
    vehicleId: 'vehicle-1',
    vehicleLicensePlateSnapshot: 'ABC1D23',
    title: 'Problema operacional',
    status: 'open',
    attachmentPaths: [],
    createdAt: '2026-07-29T10:00:00Z',
    updatedAt: '2026-07-29T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  listEventsMock.mockResolvedValue([]);
  attachmentUrlsMock.mockResolvedValue({});
  lastKmMapMock.mockResolvedValue(new Map([['vehicle-1', { value: 91800, isCorrected: false }]]));
  authState.user = { role: 'Fleet Assistant' };
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderModal(ticket: FleetTicket) {
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <FleetTicketModal ticket={ticket} onClose={vi.fn()} onSaved={vi.fn()} />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  return root;
}

describe('FleetTicketModal', () => {
  it('does not render "Alterar criticidade" for Operations Manager', async () => {
    authState.user = { role: 'Operations Manager' };
    const root = await renderModal(baseTicket());
    expect(container.textContent).not.toContain('Alterar criticidade');
    act(() => root.unmount());
  });

  it('does not render "Alterar criticidade" for Yard Auditor', async () => {
    authState.user = { role: 'Yard Auditor' };
    const root = await renderModal(baseTicket());
    expect(container.textContent).not.toContain('Alterar criticidade');
    act(() => root.unmount());
  });

  it('renders "Alterar criticidade" for Fleet Assistant', async () => {
    authState.user = { role: 'Fleet Assistant' };
    const root = await renderModal(baseTicket());
    expect(container.textContent).toContain('Alterar criticidade');
    act(() => root.unmount());
  });

  it('does not render "Alterar criticidade" for Fleet Assistant when the ticket is closed', async () => {
    authState.user = { role: 'Fleet Assistant' };
    const root = await renderModal(baseTicket({ status: 'closed' }));
    expect(container.textContent).not.toContain('Alterar criticidade');
    act(() => root.unmount());
  });

  it('does not render "Assumir atendimento" nor "Alterar status" for a closed ticket', async () => {
    authState.user = { role: 'Fleet Assistant' };
    const root = await renderModal(baseTicket({ status: 'closed' }));
    expect(container.textContent).not.toContain('Assumir atendimento');
    expect(container.textContent).not.toContain('Alterar status');
    act(() => root.unmount());
  });

  it('renders "Assumir atendimento" and "Alterar status" for an open ticket', async () => {
    authState.user = { role: 'Fleet Assistant' };
    const root = await renderModal(baseTicket({ status: 'open' }));
    expect(container.textContent).toContain('Assumir atendimento');
    expect(container.textContent).toContain('Alterar status');
    act(() => root.unmount());
  });

  it('shows odometer and vehicle snapshots when present', async () => {
    const root = await renderModal(baseTicket({
      ticketNumber: 'CH-2607-4821',
      odometerKm: 92400,
      vehicleModelSnapshot: 'Volvo FH 540',
      vehicleOwnerSnapshot: 'Transportadora Beta',
      shipperNameSnapshot: 'Embarcador X',
      operationalUnitNameSnapshot: 'Base Sul',
    }));
    expect(container.textContent).toContain('Chamado CH-2607-4821');
    expect(container.textContent).toContain('92.400 km');
    expect(container.textContent).toContain('Volvo FH 540');
    expect(container.textContent).toContain('Transportadora Beta');
    expect(container.textContent).toContain('Embarcador X');
    expect(container.textContent).toContain('Base Sul');
    act(() => root.unmount());
  });

  it('renders a legacy ticket without the new fields without crashing, showing —', async () => {
    const root = await renderModal(baseTicket());
    expect(container.textContent).toContain('—');
    act(() => root.unmount());
  });

  it('shows which status a "status_changed" event moved the ticket to', async () => {
    listEventsMock.mockResolvedValue([
      {
        id: 'event-1',
        clientId: 'client-1',
        ticketId: 'ticket-1',
        eventType: 'status_changed',
        actorNameSnapshot: 'Beatriz Lima',
        payload: { from: 'open', to: 'resolved' },
        createdAt: '2026-07-30T10:00:00Z',
      },
    ]);
    const root = await renderModal(baseTicket());
    expect(container.textContent).toContain('Status alterado para Resolvido');
    act(() => root.unmount());
  });

  it('shows resolution notes when the ticket has been resolved', async () => {
    const root = await renderModal(baseTicket({
      status: 'resolved',
      resolutionNotes: 'Bateria trocada no local pela equipe de assistência.',
      resolvedByNameSnapshot: 'Beatriz Lima',
      resolvedAt: '2026-07-30T11:00:00Z',
    }));
    expect(container.textContent).toContain('Notas de Resolução');
    expect(container.textContent).toContain('Bateria trocada no local pela equipe de assistência.');
    expect(container.textContent).toContain('Beatriz Lima');
    act(() => root.unmount());
  });

  it('does not show a resolution notes block when there are none', async () => {
    const root = await renderModal(baseTicket());
    expect(container.textContent).not.toContain('Notas de Resolução');
    act(() => root.unmount());
  });
});
