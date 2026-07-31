import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createSosMock, listVehiclesMock, capturePositionMock, lastKmMapMock, fromMock } = vi.hoisted(() => ({
  createSosMock: vi.fn(),
  listVehiclesMock: vi.fn(),
  capturePositionMock: vi.fn(),
  lastKmMapMock: vi.fn(),
  fromMock: vi.fn(),
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
vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: lastKmMapMock,
  buildLastKmDisplayParts: (info: { value: number; isCorrected: boolean } | null) =>
    info == null
      ? { prefix: 'Último Km:', valueText: null, suffix: null, fullText: 'Último Km: sem leitura' }
      : { prefix: 'Último Km:', valueText: `${info.value.toLocaleString('pt-BR')} km`, suffix: null, fullText: `Último Km: ${info.value.toLocaleString('pt-BR')} km` },
}));
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../components/CameraCapture', () => ({
  default: ({ onCapture }: { onCapture: (file: File, lat?: number, lng?: number) => void }) => (
    <button
      type="button"
      data-testid="mock-camera-capture"
      onClick={() => onCapture(new File(['fake'], 'sos.jpg', { type: 'image/jpeg' }), -23.55052, -46.63331)}
    >
      mock-capture
    </button>
  ),
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
    setValue('#sos-km', '92000');
    const cameraButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Tirar foto'))!;
    act(() => cameraButton.click());
    const mockCapture = container.querySelector('[data-testid="mock-camera-capture"]') as HTMLButtonElement;
    act(() => mockCapture.click());
    const form = container.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
    expect(createSosMock).toHaveBeenCalledWith(expect.objectContaining({
      sosType: 'breakdown',
      latitude: -23.5,
      longitude: -46.6,
      locationText: 'Rua do Russell, 434, Glória',
      odometerKm: 92000,
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
    setValue('#sos-km', '92000');
    const cameraButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Tirar foto'))!;
    act(() => cameraButton.click());
    const mockCapture = container.querySelector('[data-testid="mock-camera-capture"]') as HTMLButtonElement;
    act(() => mockCapture.click());
    const form = container.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
    expect(container.textContent).toContain('notificação Telegram falhou');
    act(() => root.unmount());
  });

  it('blocks submission without a photo', async () => {
    const root = await renderPage();
    setValue('#sos-vehicle', 'vehicle-1');
    const typeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Veículo enguiçado'))!;
    act(() => typeButton.click());
    setValue('#sos-description', 'Falha mecânica');
    setValue('#sos-km', '92000');
    const form = container.querySelector('form')!;
    act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain('A foto é obrigatória para o S.O.S.');
    expect(createSosMock).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('does not block submission when Km diverges from the last official reading', async () => {
    const root = await renderPage();
    setValue('#sos-vehicle', 'vehicle-1');
    const typeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Veículo enguiçado'))!;
    act(() => typeButton.click());
    setValue('#sos-description', 'Falha mecânica');
    setValue('#sos-km', '80000');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(container.textContent).toContain('91.800');
    const cameraButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Tirar foto'))!;
    act(() => cameraButton.click());
    const mockCapture = container.querySelector('[data-testid="mock-camera-capture"]') as HTMLButtonElement;
    act(() => mockCapture.click());
    const form = container.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
    expect(createSosMock).toHaveBeenCalledWith(expect.objectContaining({ odometerKm: 80000 }));
    act(() => root.unmount());
  });
});
