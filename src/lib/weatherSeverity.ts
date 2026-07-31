import type { WeatherForecast, WeatherSeverity } from '../types/weather';

export function getWeatherCodePresentation(weatherCode: number): { label: string; icon: string } {
  switch (weatherCode) {
    case 0:
      return { label: 'céu limpo', icon: '☀️' };
    case 1:
    case 2:
      return { label: 'parcialmente nublado', icon: '⛅' };
    case 3:
      return { label: 'nublado', icon: '☁️' };
    case 45:
    case 48:
      return { label: 'neblina', icon: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { label: 'garoa', icon: '🌦️' };
    case 61:
    case 63:
      return { label: 'chuva', icon: '🌧️' };
    case 65:
    case 82:
      return { label: 'chuva forte', icon: '🌧️' };
    case 80:
    case 81:
      return { label: 'pancadas de chuva', icon: '🌦️' };
    case 95:
    case 96:
    case 99:
      return { label: 'tempestade', icon: '⛈️' };
    default:
      return { label: 'condição climática', icon: '🌤️' };
  }
}

export function deriveWeatherSeverity(input: {
  weatherCode: number;
  precipitationProbability?: number | null;
  windGusts?: number | null;
}): WeatherSeverity {
  if ([95, 96, 99, 65, 82].includes(input.weatherCode) || (input.windGusts ?? 0) >= 70) {
    return 'severe';
  }

  if (
    [45, 48, 61, 63, 80, 81].includes(input.weatherCode) ||
    (input.precipitationProbability ?? 0) >= 70 ||
    (input.windGusts ?? 0) >= 50
  ) {
    return 'attention';
  }

  return 'normal';
}

export function combineWeatherSeverity(values: WeatherSeverity[]): WeatherSeverity {
  if (values.includes('severe')) return 'severe';
  if (values.includes('attention')) return 'attention';
  return 'normal';
}

export function buildWeatherAlertMessage(
  forecast: Pick<WeatherForecast, 'current' | 'daily' | 'overallSeverity'>,
): string | null {
  if (forecast.overallSeverity === 'normal') return null;

  const codes = [forecast.current.weatherCode, ...forecast.daily.map((day) => day.weatherCode)];
  const windGusts = [
    forecast.current.windGusts ?? 0,
    ...forecast.daily.map((day) => day.windGustsMax ?? 0),
  ];

  if (codes.some((code) => [95, 96, 99].includes(code))) {
    return 'Tempestade prevista na sua região.';
  }
  if (codes.some((code) => [65, 82].includes(code))) {
    return 'Chuva forte prevista na sua região.';
  }
  if (windGusts.some((gust) => gust >= 70)) {
    return 'Rajadas de vento fortes previstas na sua região.';
  }
  return 'Condição de atenção prevista na sua região.';
}
