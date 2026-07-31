import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, listVehiclesMock, createReportMock, lastKmMapMock, fromMock } = vi.hoisted(() => ({
  authState: { currentClient: { id: 'client-1' } },
  listVehiclesMock: vi.fn(),
  createReportMock: vi.fn(),
  lastKmMapMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../services/fleetTicketService', () => ({
  listVehiclesForFleetTicketReport: listVehiclesMock,
  createFleetTicketReport: createReportMock,
}));
vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: lastKmMapMock,
  buildLastKmDisplayParts: (info: { value: number; isCorrected: boolean } | null) =>
    info == null
      ? { prefix: 'Último Km:', valueText: null, suffix: null, fullText: 'Último Km: sem leitura' }
      : { prefix: 'Último Km:', valueText: `${info.value.toLocaleString('pt-BR')} km`, suffix: null, fullText: `Último Km: ${info.value.toLocaleString('pt-BR')} km` },
}));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));

import CreateFleetTicketModal from './CreateFleetTicketModal';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  listVehiclesMock.mockResolvedValue([{ id: 'vehicle-1', licensePlate: 'ABC1D23' }]);
  lastKmMapMock.mockResolvedValue(new Map([['vehicle-1', { value: 91800, isCorrected: false }]]));
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { odometer_km_tolerance_per_day: 500 }, error: null }),
      }),
    }),
  });
});

afterEach(() => {
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderModal() {
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <CreateFleetTicketModal open onClose={vi.fn()} onCreated={vi.fn()} />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  return root;
}

function selectVehicle(container: HTMLDivElement) {
  const select = container.querySelector('#fleet-ticket-vehicle') as HTMLSelectElement;
  act(() => {
    select.value = 'vehicle-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function selectCriticality(container: HTMLDivElement, value: string) {
  const select = container.querySelector('#fleet-ticket-criticality') as HTMLSelectElement;
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function fillKm(container: HTMLDivElement, value: string) {
  const input = container.querySelector('#fleet-ticket-km') as HTMLInputElement;
  const setNativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setNativeValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function submitButton(container: HTMLDivElement) {
  return Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Criar chamado')) as HTMLButtonElement;
}

describe('CreateFleetTicketModal', () => {
  it('renders the 4 criticality descriptions when nothing is selected', async () => {
    const root = await renderModal();
    expect(container.textContent).toContain('Para problemas em que a segurança do condutor está em risco');
    expect(container.textContent).toContain('curto prazo');
    expect(container.textContent).toContain('médio prazo');
    expect(container.textContent).toContain('longo prazo');
    act(() => root.unmount());
  });

  it('requires a photo and keeps the submit button disabled when criticality is Critical', async () => {
    const root = await renderModal();
    selectVehicle(container);
    selectCriticality(container, 'critical');
    fillKm(container, '92000');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    expect(container.textContent).toContain('Foto obrigatória para chamados críticos');
    expect(submitButton(container).disabled).toBe(true);
    act(() => root.unmount());
  });

  it('keeps the photo optional and the button enabled when criticality is Medium', async () => {
    const root = await renderModal();
    selectVehicle(container);
    selectCriticality(container, 'medium');
    fillKm(container, '92000');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    expect(container.textContent).toContain('Fotos (opcional, até 3)');
    expect(submitButton(container).disabled).toBe(false);
    act(() => root.unmount());
  });

  it('shows an amber warning for Km below the last official reading but keeps the button enabled', async () => {
    const root = await renderModal();
    selectVehicle(container);
    selectCriticality(container, 'medium');
    fillKm(container, '90000');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    const warning = container.querySelector('.border-amber-200');
    expect(warning).not.toBeNull();
    expect(submitButton(container).disabled).toBe(false);
    act(() => root.unmount());
  });

  it('keeps the button disabled when Km is empty', async () => {
    const root = await renderModal();
    selectVehicle(container);
    selectCriticality(container, 'medium');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    expect(submitButton(container).disabled).toBe(true);
    act(() => root.unmount());
  });

  it('does not render any file input (gallery upload removed)', async () => {
    const root = await renderModal();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    act(() => root.unmount());
  });
});
