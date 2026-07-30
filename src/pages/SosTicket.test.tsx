import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createSosMock, listVehiclesMock, capturePositionMock } = vi.hoisted(() => ({
  createSosMock: vi.fn(),
  listVehiclesMock: vi.fn(),
  capturePositionMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1', role: 'Driver' }, currentClient: { id: 'client-1' } }),
}));
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../lib/geolocation', () => ({ capturePosition: capturePositionMock }));
vi.mock('../services/fleetTicketService', () => ({
  createSosTicket: createSosMock,
  listVehiclesForSos: listVehiclesMock,
}));

import SosTicket from './SosTicket';

let container: HTMLDivElement;
let queryClient: QueryClient;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  listVehiclesMock.mockResolvedValue([{ id: 'vehicle-1', licensePlate: 'ABC1D23' }]);
  capturePositionMock.mockResolvedValue({ latitude: -23.5, longitude: -46.6, status: 'captured' });
  createSosMock.mockResolvedValue({ ticketId: 'ticket-1', uploadWarnings: [] });
});

afterEach(() => {
  document.body.removeChild(container);
  queryClient.clear();
  vi.clearAllMocks();
});

async function renderPage() {
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SosTicket />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return root;
}

function setValue(selector: string, value: string) {
  const element = container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SosTicket', () => {
  it('renders the emergency warning', async () => {
    const root = await renderPage();
    expect(container.textContent).toContain('Use apenas em emergência');
    act(() => root.unmount());
  });

  it('blocks submission without vehicle, type and description', async () => {
    const root = await renderPage();
    const form = container.querySelector('form')!;
    act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain('Selecione o veículo e o tipo de emergência');
    expect(createSosMock).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('requires manual location when GPS is denied', async () => {
    capturePositionMock.mockResolvedValue({ latitude: null, longitude: null, status: 'denied' });
    const root = await renderPage();
    expect(container.textContent).toContain('Endereço ou referência manual (obrigatório)');
    setValue('#sos-vehicle', 'vehicle-1');
    const typeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Veículo enguiçado'))!;
    act(() => typeButton.click());
    setValue('#sos-description', 'Falha mecânica');
    const form = container.querySelector('form')!;
    act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain('Informe o local manualmente');
    act(() => root.unmount());
  });

  it('keeps GPS capture and sends the optional manual address with the ticket', async () => {
    const root = await renderPage();
    expect(container.textContent).toContain('Endereço ou referência manual (opcional)');
    setValue('#sos-vehicle', 'vehicle-1');
    const typeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Veículo enguiçado'))!;
    act(() => typeButton.click());
    setValue('#sos-description', 'Falha mecânica');
    setValue('#sos-location', 'Rua do Russell, 434, Glória');
    const form = container.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
    expect(createSosMock).toHaveBeenCalledWith(expect.objectContaining({
      sosType: 'breakdown',
      latitude: -23.5,
      longitude: -46.6,
      locationText: 'Rua do Russell, 434, Glória',
    }));
    expect(createSosMock.mock.calls[0][0]).not.toHaveProperty('criticality');
    act(() => root.unmount());
  });

  it('shows a warning when Telegram fails after creation', async () => {
    createSosMock.mockResolvedValue({ ticketId: 'ticket-1', telegramWarning: 'Telegram indisponível', uploadWarnings: [] });
    const root = await renderPage();
    setValue('#sos-vehicle', 'vehicle-1');
    const typeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Veículo enguiçado'))!;
    act(() => typeButton.click());
    setValue('#sos-description', 'Falha mecânica');
    const form = container.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
    expect(container.textContent).toContain('notificação Telegram falhou');
    act(() => root.unmount());
  });
});
