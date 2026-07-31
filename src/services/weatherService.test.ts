import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWeatherForecast, geocodeCityState } from './weatherService';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

const forecastPayload = {
  current: {
    temperature_2m: 26,
    apparent_temperature: 27,
    precipitation: 0,
    weather_code: 2,
    wind_speed_10m: 12,
    wind_gusts_10m: 20,
  },
  daily: {
    time: ['2026-07-31', '2026-08-01', '2026-08-02'],
    weather_code: [2, 65, 95],
    temperature_2m_max: [28, 24, 23],
    temperature_2m_min: [18, 17, 16],
    precipitation_probability_max: [20, 80, 90],
    wind_gusts_10m_max: [25, 55, 65],
  },
};

function response(payload: unknown, ok = true): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(payload) };
}

describe('weatherService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('monta a URL do forecast com três dias e as variáveis obrigatórias', async () => {
    fetchMock.mockResolvedValue(response(forecastPayload));

    await fetchWeatherForecast({
      latitude: -23.55,
      longitude: -46.63,
      source: 'browser',
      locationLabel: 'Sua localização',
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('forecast_days')).toBe('3');
    expect(url.searchParams.get('current')).toContain('wind_gusts_10m');
    expect(url.searchParams.get('daily')).toContain('precipitation_probability_max');
    expect(url.searchParams.get('temperature_unit')).toBe('celsius');
  });

  it('mapeia payload válido para forecast com três dias', async () => {
    fetchMock.mockResolvedValue(response(forecastPayload));

    const forecast = await fetchWeatherForecast({
      latitude: -23.55,
      longitude: -46.63,
      source: 'browser',
      locationLabel: 'Sua localização',
    });

    expect(forecast.current.temperature).toBe(26);
    expect(forecast.daily).toHaveLength(3);
    expect(forecast.daily[1].weatherLabel).toBe('chuva forte');
    expect(forecast.daily[2].severity).toBe('severe');
    expect(forecast.overallSeverity).toBe('severe');
    expect(forecast.fetchedAt).toEqual(expect.any(String));
  });

  it('lança WEATHER_FETCH_FAILED em HTTP 500', async () => {
    fetchMock.mockResolvedValue(response({}, false));

    await expect(
      fetchWeatherForecast({ latitude: 1, longitude: 2, source: 'browser', locationLabel: 'Sua localização' }),
    ).rejects.toThrow('WEATHER_FETCH_FAILED');
  });

  it('lança WEATHER_INVALID_PAYLOAD quando faltam campos obrigatórios', async () => {
    fetchMock.mockResolvedValue(response({ current: {}, daily: { time: [] } }));

    await expect(
      fetchWeatherForecast({ latitude: 1, longitude: 2, source: 'browser', locationLabel: 'Sua localização' }),
    ).rejects.toThrow('WEATHER_INVALID_PAYLOAD');
  });

  it('prioriza o resultado brasileiro com estado compatível no geocoding', async () => {
    fetchMock.mockResolvedValue(
      response({
        results: [
          { latitude: -10, longitude: -40, country_code: 'BR', admin1: 'Bahia' },
          { latitude: -23.55, longitude: -46.63, country_code: 'BR', admin1: 'São Paulo' },
        ],
      }),
    );

    await expect(geocodeCityState({ city: 'São Paulo', state: 'SP' })).resolves.toEqual({
      latitude: -23.55,
      longitude: -46.63,
    });
  });

  it('retorna null para lista vazia ou erro de rede no geocoding', async () => {
    fetchMock.mockResolvedValueOnce(response({ results: [] }));
    await expect(geocodeCityState({ city: 'Cidade inexistente' })).resolves.toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(geocodeCityState({ city: 'São Paulo' })).resolves.toBeNull();
  });
});
