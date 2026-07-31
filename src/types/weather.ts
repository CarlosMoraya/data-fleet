export type WeatherSeverity = 'normal' | 'attention' | 'severe';

export type WeatherLocationSource = 'browser' | 'driver-operational-unit';

export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherCurrentCondition {
  temperature: number;
  apparentTemperature: number | null;
  weatherCode: number;
  weatherLabel: string;
  icon: string;
  precipitation: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  severity: WeatherSeverity;
}

export interface WeatherDailyForecast {
  date: string;
  weatherCode: number;
  weatherLabel: string;
  icon: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbabilityMax: number | null;
  windGustsMax: number | null;
  severity: WeatherSeverity;
}

export interface WeatherForecast {
  source: WeatherLocationSource;
  locationLabel: string;
  coordinates: WeatherCoordinates;
  current: WeatherCurrentCondition;
  daily: WeatherDailyForecast[];
  overallSeverity: WeatherSeverity;
  alertMessage: string | null;
  fetchedAt: string;
}

export interface LocalWeatherResult {
  status: 'hidden' | 'needsPermission' | 'loading' | 'ready' | 'error';
  forecast: WeatherForecast | null;
  error: Error | null;
  requestPermission: () => void;
}
