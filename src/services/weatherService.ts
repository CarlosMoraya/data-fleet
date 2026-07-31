import {
  buildWeatherAlertMessage,
  combineWeatherSeverity,
  deriveWeatherSeverity,
  getWeatherCodePresentation,
} from '../lib/weatherSeverity';

import type {
  WeatherCoordinates,
  WeatherForecast,
  WeatherLocationSource,
} from '../types/weather';

const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REQUEST_TIMEOUT_MS = 8000;

export interface FetchWeatherForecastInput extends WeatherCoordinates {
  source: WeatherLocationSource;
  locationLabel: string;
}

export interface GeocodeCityStateInput {
  city: string;
  state?: string | null;
}

const BR_STATE_NAMES_BY_UF: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

type ForecastPayload = {
  current: Record<string, unknown>;
  daily: Record<string, unknown[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildForecastUrl(input: WeatherCoordinates): string {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max',
    forecast_days: '3',
    timezone: 'auto',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  });
  return `${FORECAST_API_URL}?${params.toString()}`;
}

function assertForecastPayload(payload: unknown): asserts payload is ForecastPayload {
  if (
    !isRecord(payload) ||
    !isRecord(payload.current) ||
    !isRecord(payload.daily) ||
    !Array.isArray(payload.daily.time) ||
    !Array.isArray(payload.daily.weather_code)
  ) {
    throw new Error('WEATHER_INVALID_PAYLOAD');
  }
}

function mapForecastPayload(payload: ForecastPayload, input: FetchWeatherForecastInput): WeatherForecast {
  const currentCode = numberOrZero(payload.current.weather_code);
  const currentPresentation = getWeatherCodePresentation(currentCode);
  const currentSeverity = deriveWeatherSeverity({
    weatherCode: currentCode,
    windGusts: numberOrNull(payload.current.wind_gusts_10m),
  });
  const dailyLength = Math.min(3, payload.daily.time.length, payload.daily.weather_code.length);
  const daily = Array.from({ length: dailyLength }, (_, index) => {
    const weatherCode = numberOrZero(payload.daily.weather_code[index]);
    const presentation = getWeatherCodePresentation(weatherCode);
    const precipitationProbabilityMax = numberOrNull(payload.daily.precipitation_probability_max?.[index]);
    const windGustsMax = numberOrNull(payload.daily.wind_gusts_10m_max?.[index]);
    return {
      date: stringOrEmpty(payload.daily.time[index]),
      weatherCode,
      weatherLabel: presentation.label,
      icon: presentation.icon,
      temperatureMax: numberOrZero(payload.daily.temperature_2m_max?.[index]),
      temperatureMin: numberOrZero(payload.daily.temperature_2m_min?.[index]),
      precipitationProbabilityMax,
      windGustsMax,
      severity: deriveWeatherSeverity({ weatherCode, precipitationProbability: precipitationProbabilityMax, windGusts: windGustsMax }),
    };
  });
  const forecast: WeatherForecast = {
    source: input.source,
    locationLabel: input.locationLabel,
    coordinates: { latitude: input.latitude, longitude: input.longitude },
    current: {
      temperature: numberOrZero(payload.current.temperature_2m),
      apparentTemperature: numberOrNull(payload.current.apparent_temperature),
      weatherCode: currentCode,
      weatherLabel: currentPresentation.label,
      icon: currentPresentation.icon,
      precipitation: numberOrNull(payload.current.precipitation),
      windSpeed: numberOrNull(payload.current.wind_speed_10m),
      windGusts: numberOrNull(payload.current.wind_gusts_10m),
      severity: currentSeverity,
    },
    daily,
    overallSeverity: combineWeatherSeverity([currentSeverity, ...daily.map((day) => day.severity)]),
    alertMessage: null,
    fetchedAt: new Date().toISOString(),
  };
  forecast.alertMessage = buildWeatherAlertMessage(forecast);
  return forecast;
}

export async function fetchWeatherForecast(input: FetchWeatherForecastInput): Promise<WeatherForecast> {
  let payload: unknown;
  try {
    payload = await fetchJsonWithTimeout(buildForecastUrl(input));
  } catch {
    throw new Error('WEATHER_FETCH_FAILED');
  }
  assertForecastPayload(payload);
  return mapForecastPayload(payload, input);
}

export async function geocodeCityState(input: GeocodeCityStateInput): Promise<WeatherCoordinates | null> {
  if (!input.city.trim()) return null;

  const params = new URLSearchParams({ name: input.city, count: '10', language: 'pt', format: 'json' });
  try {
    const payload = await fetchJsonWithTimeout(`${GEOCODING_API_URL}?${params.toString()}`);
    if (!isRecord(payload) || !Array.isArray(payload.results)) return null;

    const brazilianResults = payload.results.filter(
      (result): result is Record<string, unknown> =>
        isRecord(result) && stringOrEmpty(result.country_code).toUpperCase() === 'BR',
    );
    if (brazilianResults.length === 0) return null;

    const stateUf = input.state?.trim().toUpperCase();
    const expectedState = stateUf ? BR_STATE_NAMES_BY_UF[stateUf] : undefined;
    const stateMatch = expectedState
      ? brazilianResults.find(
          (result) => stringOrEmpty(result.admin1).toLocaleLowerCase() === expectedState.toLocaleLowerCase(),
        )
      : undefined;
    const selected = stateMatch ?? brazilianResults[0];
    const latitude = numberOrNull(selected.latitude);
    const longitude = numberOrNull(selected.longitude);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  } catch {
    return null;
  }
}
