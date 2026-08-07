import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, listEventsMock, attachmentUrlsMock, lastKmMapMock, updateStatusMock, openTreatmentMock } = vi.hoisted(() => ({
  authState: { user: { id: 'user-1', role: 'Fleet Assistant' as string } as { id?: string; role: string }, currentClient: { id: 'client-1' } },
  listEventsMock: vi.fn(),
  attachmentUrlsMock: vi.fn(),
  lastKmMapMock: vi.fn(),
  updateStatusMock: vi.fn(),
  openTreatmentMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../services/fleetTicketService', () => ({
  assignFleetTicketToSelf: vi.fn(),
  classifyFleetTicket: vi.fn(),
  getFleetTicketAttachmentUrls: attachmentUrlsMock,
  listFleetTicketEvents: listEventsMock,
  updateFleetTicketStatus: updateStatusMock,
}));
vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: lastKmMapMock,
  buildLastKmDisplayParts: (info: { value: number; isCorrected: boolean } | null) =>
    info == null
      ? { prefix: 'Último Km:', valueText: null, suffix: null, fullText: 'Último Km: sem leitura' }
      : { prefix: 'Último Km:', valueText: `${info.value.toLocaleString('pt-BR')} km`, suffix: null, fullText: `Último Km: ${info.value.toLocaleString('pt-BR')} km` },
}));
vi.mock('../services/vehicleOpenTreatmentService', () => ({
  getVehicleOpenTreatment: openTreatmentMock,
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
  updateStatusMock.mockResolvedValue(undefined);
  openTreatmentMock.mockResolvedValue({ actionPlans: [], schedules: [], ticketPlanIds: [] });
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

  function setSelectValue(select: HTMLSelectElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function getSaveStatusButton(): HTMLButtonElement {
    return Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Salvar status') as HTMLButtonElement;
  }

  it('disables "Salvar status" and shows the message when choosing Resolvido without an assignee', async () => {
    const root = await renderModal(baseTicket({ status: 'open' }));
    const select = container.querySelector('#ticket-status') as HTMLSelectElement;
    setSelectValue(select, 'resolved');
    expect(getSaveStatusButton().disabled).toBe(true);
    expect(container.textContent).toContain('Assuma o atendimento antes de alterar o status deste chamado.');
    act(() => root.unmount());
  });

  it('disables "Salvar status" and shows the message when choosing Encerrado without an assignee', async () => {
    const root = await renderModal(baseTicket({ status: 'open' }));
    const select = container.querySelector('#ticket-status') as HTMLSelectElement;
    setSelectValue(select, 'closed');
    expect(getSaveStatusButton().disabled).toBe(true);
    expect(container.textContent).toContain('Assuma o atendimento antes de alterar o status deste chamado.');
    act(() => root.unmount());
  });

  it('disables "Salvar status" and shows the message when choosing Cancelado without an assignee', async () => {
    const root = await renderModal(baseTicket({ status: 'open' }));
    const select = container.querySelector('#ticket-status') as HTMLSelectElement;
    setSelectValue(select, 'cancelled');
    expect(getSaveStatusButton().disabled).toBe(true);
    expect(container.textContent).toContain('Assuma o atendimento antes de alterar o status deste chamado.');
    act(() => root.unmount());
  });

  it('keeps "Salvar status" enabled for a ticket with an assignee choosing Cancelado', async () => {
    const root = await renderModal(baseTicket({ status: 'open', assignedTo: 'user-2', assignedToNameSnapshot: 'Carlos' }));
    const select = container.querySelector('#ticket-status') as HTMLSelectElement;
    setSelectValue(select, 'cancelled');
    expect(getSaveStatusButton().disabled).toBe(false);
    expect(container.textContent).not.toContain('Assuma o atendimento antes de alterar o status deste chamado.');
    act(() => root.unmount());
  });

  it('enables "Salvar status" for a ticket with an assignee choosing Resolvido with notes', async () => {
    const root = await renderModal(baseTicket({ status: 'in_progress', assignedTo: 'user-2', assignedToNameSnapshot: 'Carlos' }));
    const select = container.querySelector('#ticket-status') as HTMLSelectElement;
    setSelectValue(select, 'resolved');
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(textarea, 'Bateria trocada com sucesso.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(getSaveStatusButton().disabled).toBe(false);
    expect(container.textContent).not.toContain('Assuma o atendimento antes de alterar o status deste chamado.');
    act(() => root.unmount());
  });

  it('does not call updateFleetTicketStatus when trying to conclude without an assignee', async () => {
    const root = await renderModal(baseTicket({ status: 'open' }));
    const select = container.querySelector('#ticket-status') as HTMLSelectElement;
    setSelectValue(select, 'resolved');
    act(() => { getSaveStatusButton().click(); });
    await act(async () => { await Promise.resolve(); });
    expect(updateStatusMock).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('shows "Abrir plano de ação" for Fleet Analyst on an in_progress assigned ticket and opens the creation modal', async () => {
    authState.user = { role: 'Fleet Analyst' };
    const root = await renderModal(baseTicket({ status: 'in_progress', assignedTo: 'user-2' }));
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Abrir plano de ação');
    expect(button).toBeTruthy();
    act(() => { button!.click(); });
    expect(container.textContent).toContain('Criar Plano de Ação');
    act(() => root.unmount());
  });

  it('does not render "Abrir plano de ação" for Fleet Assistant', async () => {
    authState.user = { role: 'Fleet Assistant' };
    const root = await renderModal(baseTicket({ status: 'in_progress', assignedTo: 'user-2' }));
    expect(container.textContent).not.toContain('Abrir plano de ação');
    act(() => root.unmount());
  });

  it('does not render "Abrir plano de ação" for a closed ticket', async () => {
    authState.user = { role: 'Director' };
    const root = await renderModal(baseTicket({ status: 'closed', assignedTo: 'user-2' }));
    expect(container.textContent).not.toContain('Abrir plano de ação');
    act(() => root.unmount());
  });

  it('shows the open-treatment panel with the plan name when the vehicle has one, without disabling any button', async () => {
    openTreatmentMock.mockResolvedValue({
      actionPlans: [{ id: 'plan-1', name: 'Revisão de freios', suggestedAction: 'Trocar pastilhas', status: 'pending', dueDate: '2026-08-10', responsibleName: 'Ana' }],
      schedules: [],
      ticketPlanIds: [],
    });
    const root = await renderModal(baseTicket({ status: 'open' }));
    await waitForText(container, 'Este veículo já está em tratamento');
    expect(container.textContent).toContain('Revisão de freios');
    const assumeButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Assumir atendimento'));
    expect(assumeButton?.disabled).toBe(false);
    act(() => root.unmount());
  });

  it('does not render the open-treatment panel when there are no plans nor schedules', async () => {
    openTreatmentMock.mockResolvedValue({ actionPlans: [], schedules: [], ticketPlanIds: [] });
    const root = await renderModal(baseTicket());
    expect(container.textContent).not.toContain('Este veículo já está em tratamento');
    act(() => root.unmount());
  });
});

async function waitForText(node: HTMLElement, text: string) {
  for (let i = 0; i < 20; i += 1) {
    if (node.textContent?.includes(text)) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error(`Texto não encontrado: ${text}`);
}
