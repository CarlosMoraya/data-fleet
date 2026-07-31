import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useLocalWeatherMock } = vi.hoisted(() => ({ useLocalWeatherMock: vi.fn() }));

vi.mock('../hooks/useLocalWeather', () => ({ useLocalWeather: useLocalWeatherMock }));

import LocalWeatherChip from './LocalWeatherChip';

let container: HTMLDivElement;
let root: Root;
const requestPermission = vi.fn();

const baseForecast = {
  source: 'browser' as const,
  locationLabel: 'Sua localização',
  coordinates: { latitude: -23.55, longitude: -46.63 },
  current: {
    temperature: 26.4,
    apparentTemperature: 27,
    weatherCode: 2,
    weatherLabel: 'parcialmente nublado',
    icon: '⛅',
    precipitation: 0,
    windSpeed: 10,
    windGusts: 20,
    severity: 'normal' as const,
  },
  daily: [
    { date: '2026-07-31', weatherCode: 2, weatherLabel: 'parcialmente nublado', icon: '⛅', temperatureMax: 28, temperatureMin: 18, precipitationProbabilityMax: 20, windGustsMax: 25, severity: 'normal' as const },
    { date: '2026-08-01', weatherCode: 61, weatherLabel: 'chuva', icon: '🌧️', temperatureMax: 24, temperatureMin: 17, precipitationProbabilityMax: 70, windGustsMax: 45, severity: 'attention' as const },
    { date: '2026-08-02', weatherCode: 0, weatherLabel: 'céu limpo', icon: '☀️', temperatureMax: 29, temperatureMin: 19, precipitationProbabilityMax: 10, windGustsMax: 20, severity: 'normal' as const },
  ],
  overallSeverity: 'normal' as const,
  alertMessage: null,
  fetchedAt: '2026-07-31T12:00:00.000Z',
};

function renderChip() {
  root = createRoot(container);
  act(() => {
    root.render(<LocalWeatherChip />);
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  requestPermission.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('LocalWeatherChip', () => {
  it('retorna null quando o status é hidden', () => {
    useLocalWeatherMock.mockReturnValue({ status: 'hidden', forecast: null, error: null, requestPermission });
    renderChip();
    expect(container.textContent).toBe('');
  });

  it('renderiza ação de permissão e chama requestPermission', () => {
    useLocalWeatherMock.mockReturnValue({ status: 'needsPermission', forecast: null, error: null, requestPermission });
    renderChip();
    const button = container.querySelector('button[aria-label="Ativar clima local"]') as HTMLButtonElement;
    expect(container.textContent).toContain('Clima local');
    act(() => button.click());
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('renderiza temperatura arredondada no estado ready', () => {
    useLocalWeatherMock.mockReturnValue({ status: 'ready', forecast: baseForecast, error: null, requestPermission });
    renderChip();
    expect(container.textContent).toContain('26°');
    expect(container.querySelector('button[aria-label="Clima local: 26 graus, parcialmente nublado"]')).not.toBeNull();
  });

  it('abre popover no clique e mostra três dias', () => {
    useLocalWeatherMock.mockReturnValue({ status: 'ready', forecast: baseForecast, error: null, requestPermission });
    renderChip();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => (container.querySelector('button[aria-expanded="false"]') as HTMLButtonElement).click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="dialog"] .flex.items-center.justify-between')).toHaveLength(3);
  });

  it('aplica classes de atenção e severo', () => {
    useLocalWeatherMock.mockReturnValue({
      status: 'ready',
      forecast: { ...baseForecast, overallSeverity: 'attention' },
      error: null,
      requestPermission,
    });
    renderChip();
    expect(container.querySelector('button')?.className).toContain('border-amber-200');

    act(() => root.unmount());
    root = createRoot(container);
    useLocalWeatherMock.mockReturnValue({
      status: 'ready',
      forecast: { ...baseForecast, overallSeverity: 'severe' },
      error: null,
      requestPermission,
    });
    act(() => root.render(<LocalWeatherChip />));
    expect(container.querySelector('button')?.className).toContain('border-red-200');
  });
});
