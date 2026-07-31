import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, capturePositionMock, fetchWeatherForecastMock, fallbackMock, onlineState } = vi.hoisted(() => ({
  authState: { user: null as { id: string; role: string } | null, currentClient: null as { id: string } | null },
  capturePositionMock: vi.fn(),
  fetchWeatherForecastMock: vi.fn(),
  fallbackMock: vi.fn(),
  onlineState: { value: true },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../lib/geolocation', () => ({ capturePosition: capturePositionMock }));
vi.mock('../services/weatherService', () => ({ fetchWeatherForecast: fetchWeatherForecastMock }));
vi.mock('../services/driverWeatherFallbackService', () => ({
  resolveDriverWeatherFallbackCoordinates: fallbackMock,
}));
vi.mock('./useOnlineStatus', () => ({ useOnlineStatus: () => onlineState.value }));

import { useLocalWeather } from './useLocalWeather';

let container: HTMLDivElement;
let root: Root;
let latestResult: ReturnType<typeof useLocalWeather>;

const forecast = {
  source: 'browser' as const,
  locationLabel: 'Sua localização',
  coordinates: { latitude: -23.55, longitude: -46.63 },
  current: {
    temperature: 26,
    apparentTemperature: 27,
    weatherCode: 2,
    weatherLabel: 'parcialmente nublado',
    icon: '⛅',
    precipitation: 0,
    windSpeed: 10,
    windGusts: 20,
    severity: 'normal' as const,
  },
  daily: [],
  overallSeverity: 'normal' as const,
  alertMessage: null,
  fetchedAt: '2026-07-31T12:00:00.000Z',
};

function Probe() {
  latestResult = useLocalWeather();
  return <button type="button" data-status={latestResult.status} onClick={latestResult.requestPermission} />;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setPermissionState(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state }) },
  });
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  authState.user = { id: 'user-1', role: 'Fleet Analyst' };
  authState.currentClient = { id: 'client-1' };
  onlineState.value = true;
  capturePositionMock.mockReset();
  fetchWeatherForecastMock.mockReset().mockResolvedValue(forecast);
  fallbackMock.mockReset();
  setPermissionState('prompt');
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
  vi.unstubAllGlobals();
});

describe('useLocalWeather', () => {
  it('retorna hidden offline e não chama forecast', () => {
    onlineState.value = false;
    authState.user = { id: 'user-1', role: 'Fleet Analyst' };
    renderProbe();

    expect(latestResult.status).toBe('hidden');
    expect(fetchWeatherForecastMock).not.toHaveBeenCalled();
  });

  it('retorna needsPermission no prompt e busca forecast após o clique', async () => {
    capturePositionMock.mockResolvedValue({ latitude: -23.55, longitude: -46.63, status: 'captured' });
    renderProbe();
    await flush();
    expect(latestResult.status).toBe('needsPermission');

    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    await flush();
    await flush();

    expect(capturePositionMock).toHaveBeenCalledTimes(1);
    expect(fetchWeatherForecastMock).toHaveBeenCalledWith({
      source: 'browser',
      latitude: -23.55,
      longitude: -46.63,
      locationLabel: 'Sua localização',
    });
    expect(latestResult.status).toBe('ready');
  });

  it('com permissão granted busca forecast automaticamente', async () => {
    setPermissionState('granted');
    capturePositionMock.mockResolvedValue({ latitude: -23.55, longitude: -46.63, status: 'captured' });
    renderProbe();
    await flush();
    await flush();

    expect(capturePositionMock).toHaveBeenCalledTimes(1);
    expect(fetchWeatherForecastMock).toHaveBeenCalledTimes(1);
  });

  it('com localização negada tenta fallback do Driver', async () => {
    authState.user = { id: 'user-1', role: 'Driver' };
    setPermissionState('denied');
    fallbackMock.mockResolvedValue({
      coordinates: { latitude: -23.55, longitude: -46.63 },
      locationLabel: 'São Paulo/SP',
    });
    fetchWeatherForecastMock.mockResolvedValue({ ...forecast, source: 'driver-operational-unit', locationLabel: 'São Paulo/SP' });
    renderProbe();
    await flush();
    await flush();

    expect(fallbackMock).toHaveBeenCalledWith({ profileId: 'user-1', clientId: 'client-1' });
    expect(fetchWeatherForecastMock).toHaveBeenCalledWith({
      source: 'driver-operational-unit',
      latitude: -23.55,
      longitude: -46.63,
      locationLabel: 'São Paulo/SP',
    });
  });

  it('com localização negada para não Driver retorna hidden', async () => {
    setPermissionState('denied');
    renderProbe();
    await flush();

    expect(latestResult.status).toBe('hidden');
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it('oculta após o não Driver negar a localização no prompt', async () => {
    capturePositionMock.mockResolvedValue({ latitude: null, longitude: null, status: 'denied' });
    renderProbe();
    await flush();
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    await flush();

    expect(latestResult.status).toBe('hidden');
  });
});
